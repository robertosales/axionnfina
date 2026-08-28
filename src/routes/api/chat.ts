import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Você é o Axionn, um agente financeiro pessoal brasileiro.
Arquitetura: você atua como Planner + Specialists — planeje a resposta, chame as ferramentas
necessárias para obter dados REAIS do usuário e só então responda.

Regras rígidas (guardrails):
- Nunca invente números. Se não houver dado, diga que não há registros.
- Valores sempre em Real (R$) com duas casas decimais.
- Nunca execute pagamentos ou transferências sem confirmação explícita do usuário.
- Para agendar Pix, use a tool schedule_pix_payment e deixe que o usuário confirme no card.
- Não forneça recomendação de investimento personalizada como se fosse consultoria regulada (CVM);
  contextualize como educação financeira.
- Não sugira evasão fiscal ou sonegação.
- Responda em português do Brasil, direto e objetivo, usando listas curtas quando ajudar.
- Quando o usuário pedir para criar uma meta, use a tool create_goal.
- Quando o usuário mencionar uma preferência ou padrão, salve com upsert_memory.`;

/** Cria um client Supabase que age como o usuário autenticado (RLS aplicada). */
function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI indisponível", { status: 500 });

        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = userClient(token);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as { messages: UIMessage[] };

        const gateway = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: gateway(MODEL),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages),
          stopWhen: stepCountIs(50),
          tools: {
            /* ---------------------------------------------------------- */
            /* Tool: resumo_financeiro                                     */
            /* ---------------------------------------------------------- */
            resumo_financeiro: tool({
              description:
                "Retorna patrimônio, saldo por conta e taxa de poupança do mês corrente do usuário.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data: accounts } = await supabase
                  .from("accounts")
                  .select("name, institution, type, balance")
                  .eq("user_id", userId);
                const start = new Date();
                start.setDate(1);
                const { data: txs } = await supabase
                  .from("transactions")
                  .select("amount, type")
                  .eq("user_id", userId)
                  .gte("occurred_at", start.toISOString().slice(0, 10));
                const income = (txs ?? [])
                  .filter((t) => t.type === "income")
                  .reduce((sum, t) => sum + Number(t.amount), 0);
                const expense = (txs ?? [])
                  .filter((t) => t.type === "expense")
                  .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
                return {
                  contas: accounts ?? [],
                  patrimonio: (accounts ?? []).reduce((sum, a) => sum + Number(a.balance), 0),
                  receitasMes: income,
                  despesasMes: expense,
                  taxaPoupanca: income > 0 ? ((income - expense) / income) * 100 : 0,
                };
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: buscar_transacoes                                     */
            /* ---------------------------------------------------------- */
            buscar_transacoes: tool({
              description:
                "Busca transações do usuário por texto, categoria e período. Use para perguntas do tipo 'quanto gastei com X'.",
              inputSchema: z.object({
                termo: z.string().describe("Texto livre para buscar em descrição/merchant/categoria"),
                dataInicio: z.string().describe("Data inicial YYYY-MM-DD"),
                dataFim: z.string().describe("Data final YYYY-MM-DD"),
              }),
              execute: async ({ termo, dataInicio, dataFim }) => {
                const { data } = await supabase
                  .from("transactions")
                  .select("description, merchant, category, amount, type, occurred_at")
                  .eq("user_id", userId)
                  .gte("occurred_at", dataInicio)
                  .lte("occurred_at", dataFim)
                  .order("occurred_at", { ascending: false })
                  .limit(200);
                const term = termo.trim().toLowerCase();
                const rows = (data ?? []).filter(
                  (t) =>
                    term.length === 0 ||
                    `${t.description} ${t.merchant ?? ""} ${t.category}`.toLowerCase().includes(term),
                );
                return {
                  quantidade: rows.length,
                  total: rows.reduce((sum, t) => sum + Number(t.amount), 0),
                  transacoes: rows.slice(0, 40),
                };
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: status_orcamento                                      */
            /* ---------------------------------------------------------- */
            status_orcamento: tool({
              description: "Status do orçamento do mês: planejado x realizado por categoria.",
              inputSchema: z.object({}),
              execute: async () => {
                const start = new Date();
                start.setDate(1);
                const monthStart = start.toISOString().slice(0, 10);
                const { data: budgets } = await supabase
                  .from("budgets")
                  .select("category, planned")
                  .eq("user_id", userId)
                  .eq("month", monthStart);
                const { data: txs } = await supabase
                  .from("transactions")
                  .select("category, amount, type")
                  .eq("user_id", userId)
                  .gte("occurred_at", monthStart);
                return (budgets ?? []).map((budget) => {
                  const spent = (txs ?? [])
                    .filter((t) => t.category === budget.category && t.type === "expense")
                    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
                  return {
                    categoria: budget.category,
                    planejado: Number(budget.planned),
                    gasto: spent,
                    percentual: Number(budget.planned) > 0 ? (spent / Number(budget.planned)) * 100 : 0,
                  };
                });
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: projecao_fluxo_caixa                                  */
            /* ---------------------------------------------------------- */
            projecao_fluxo_caixa: tool({
              description:
                "Projeta o fluxo de caixa dos próximos meses com base em contas a pagar/receber e média histórica.",
              inputSchema: z.object({ meses: z.number().describe("Quantidade de meses a projetar") }),
              execute: async ({ meses }) => {
                const { data, error } = await supabase.rpc("get_cashflow_projection", {
                  horizon_days: Math.max(30, Math.min(365, Math.round(meses) * 30)),
                });
                if (error) return { erro: error.message };
                return { projecao: data };
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: metas                                                 */
            /* ---------------------------------------------------------- */
            metas: tool({
              description: "Lista as metas financeiras do usuário com progresso e prazo.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabase
                  .from("goals")
                  .select("title, target_amount, current_amount, deadline")
                  .eq("user_id", userId);
                return data ?? [];
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: calculate_tax_preview                                 */
            /* ---------------------------------------------------------- */
            calculate_tax_preview: tool({
              description:
                "Calcula a prévia de impostos do mês corrente: swing trade, day trade, FIIs, dividendos e DARF estimada.",
              inputSchema: z.object({
                ano: z.number().describe("Ano para cálculo (YYYY)"),
                mes: z.number().describe("Mês para cálculo (1-12)"),
              }),
              execute: async ({ ano, mes }) => {
                const { data, error } = await supabase.rpc("calculate_irpf_monthly", {
                  p_year: ano,
                  p_month: mes,
                });
                if (error) return { erro: error.message };
                return data;
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: create_goal                                           */
            /* ---------------------------------------------------------- */
            create_goal: tool({
              description:
                "Cria uma nova meta financeira para o usuário. Use quando ele pedir para criar uma meta.",
              inputSchema: z.object({
                titulo: z.string().describe("Título da meta"),
                valorAlvo: z.number().describe("Valor alvo em reais"),
                prazo: z.string().optional().describe("Data limite YYYY-MM-DD (opcional)"),
              }),
              execute: async ({ titulo, valorAlvo, prazo }) => {
                const { data, error } = await supabase
                  .from("goals")
                  .insert({
                    user_id: userId,
                    title: titulo,
                    target_amount: valorAlvo,
                    current_amount: 0,
                    deadline: prazo ?? null,
                  })
                  .select("id, title, target_amount, current_amount, deadline")
                  .single();
                if (error) return { erro: error.message };
                return {
                  criada: true,
                  meta: {
                    id: data.id,
                    titulo: data.title,
                    valorAlvo: Number(data.target_amount),
                    prazo: data.deadline,
                  },
                };
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: schedule_pix_payment                                  */
            /* ---------------------------------------------------------- */
            schedule_pix_payment: tool({
              description:
                "Agenda um pagamento Pix. NÃO executa automaticamente — retorna um card de confirmação para o usuário confirmar no chat.",
              inputSchema: z.object({
                valor: z.number().describe("Valor em reais"),
                destinatario: z.string().describe("Nome ou chave Pix do destinatário"),
                data: z.string().optional().describe("Data agendada YYYY-MM-DD (padrão: hoje)"),
                contaId: z.string().optional().describe("ID da conta de origem"),
              }),
              execute: async ({ valor, destinatario, data, contaId }) => {
                const agendamento = data ?? new Date().toISOString().slice(0, 10);
                const confirmationToken = crypto.randomUUID();

                // Criar payable rascunho (não confirmado ainda)
                const { error } = await supabase.from("payables").insert({
                  user_id: userId,
                  account_id: contaId ?? null,
                  description: `Pix para ${destinatario}`,
                  amount: valor,
                  due_date: agendamento,
                  status: "pending",
                  category: "Transferência",
                  confirmation_token: confirmationToken,
                });

                if (error) return { erro: error.message };

                return {
                  amount: valor,
                  to: destinatario,
                  when: agendamento,
                  confirmationToken,
                  status: "AGUARDANDO_CONFIRMACAO",
                };
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: upsert_memory                                         */
            /* ---------------------------------------------------------- */
            upsert_memory: tool({
              description:
                "Salva uma preferência, padrão ou informação importante do usuário na memória do agente.",
              inputSchema: z.object({
                conteudo: z.string().describe("Conteúdo da memória (ex: 'Usuário prefere reserva de 6 meses')"),
                tipo: z.string().optional().describe("Tipo: preference, pattern, insight (padrão: preference)"),
                importancia: z.number().optional().describe("Importância de 0 a 1 (padrão: 0.5)"),
              }),
              execute: async ({ conteudo, tipo, importancia }) => {
                const { error } = await supabase.from("agent_memories").insert({
                  user_id: userId,
                  content: conteudo,
                  memory_type: tipo ?? "preference",
                  importance: importancia ?? 0.5,
                });
                if (error) return { erro: error.message };
                return { salva: true, conteudo };
              },
            }),

            /* ---------------------------------------------------------- */
            /* Tool: search_memories                                       */
            /* ---------------------------------------------------------- */
            search_memories: tool({
              description:
                "Busca memórias salvas do usuário por similaridade semântica. Use para lembrar de preferências e padrões anteriores.",
              inputSchema: z.object({
                query: z.string().describe("Texto de busca"),
                limite: z.number().optional().describe("Número máximo de resultados (padrão: 5)"),
              }),
              execute: async ({ query, limite }) => {
                // Para busca semântica real precisaríamos gerar embedding.
                // Por enquanto, busca por texto conteúdo.
                const { data, error } = await supabase
                  .from("agent_memories")
                  .select("content, memory_type, importance")
                  .eq("user_id", userId)
                  .ilike("content", `%${query}%`)
                  .order("importance", { ascending: false })
                  .limit(limite ?? 5);
                if (error) return { erro: error.message };
                return { memorias: data ?? [] };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
