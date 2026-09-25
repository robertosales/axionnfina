import { createFileRoute } from "@tanstack/react-router";

const TOOLS = [
  {
    name: "resumo_financeiro",
    description: "Patrimônio, saldo por conta e taxa de poupança do mês corrente.",
    input: {},
  },
  {
    name: "buscar_transacoes",
    description: "Busca transações por texto, categoria e período.",
    input: { termo: "string", dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD" },
  },
  {
    name: "status_orcamento",
    description: "Planejado x realizado por categoria no mês.",
    input: {},
  },
  {
    name: "alertas_orcamento",
    description: "Categorias com 80%+ do limite utilizado ou estouradas.",
    input: {},
  },
  {
    name: "alertas_contas",
    description: "Contas vencidas ou vencendo em até 3 dias.",
    input: {},
  },
  {
    name: "projecao_fluxo_caixa",
    description: "Projeção de fluxo de caixa dos próximos meses.",
    input: { meses: "number" },
  },
  {
    name: "metas",
    description: "Metas financeiras com progresso e prazo.",
    input: {},
  },
  {
    name: "calculate_tax_preview",
    description: "Prévia de IRPF do mês: swing, day trade, FIIs, dividendos e DARF.",
    input: { ano: "number", mes: "number 1-12" },
  },
  {
    name: "create_goal",
    description: "Cria uma nova meta financeira.",
    input: { titulo: "string", valorAlvo: "number", prazo: "YYYY-MM-DD?" },
  },
  {
    name: "schedule_pix_payment",
    description: "Agenda Pix (retorna card de confirmação, não executa sozinho).",
    input: { valor: "number", destinatario: "string", data: "YYYY-MM-DD?", contaId: "uuid?" },
  },
  {
    name: "upsert_memory",
    description: "Salva preferência/padrão do usuário na memória do agente.",
    input: { conteudo: "string", tipo: "preference|pattern|insight?", importancia: "0-1?" },
  },
  {
    name: "search_memories",
    description: "Busca memórias do usuário por similaridade.",
    input: { query: "string", limite: "number?" },
  },
] as const;

export const Route = createFileRoute("/api/agent-health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            status: "ok",
            agent: "Axionn",
            tools: TOOLS.length,
            timestamp: new Date().toISOString(),
            chat: "/api/chat",
            toolsSchema: "/api/agent-tools",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
