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
- Nunca execute pagamentos ou transferências; apenas explique como o usuário pode fazê-lo.
- Não forneça recomendação de investimento personalizada como se fosse consultoria regulada (CVM);
  contextualize como educação financeira.
- Responda em português do Brasil, direto e objetivo, usando listas curtas quando ajudar.`;

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
          messages: convertToModelMessages(body.messages),
          stopWhen: stepCountIs(50),
          tools: {
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

            projecao_fluxo_caixa: tool({
              description:
                "Projeta o fluxo de caixa dos próximos meses com base em contas a pagar/receber e média histórica.",
              inputSchema: z.object({ meses: z.number().describe("Quantidade de meses a projetar") }),
              execute: async ({ meses }) => {
                const { data, error } = await supabase.rpc("get_cashflow_projection", {
                  _user_id: userId,
                  _months: Math.max(1, Math.min(12, Math.round(meses))),
                });
                if (error) return { erro: error.message };
                return { projecao: data };
              },
            }),

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
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
