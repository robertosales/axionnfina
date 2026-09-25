import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/agent-tools
 * Schema aberto das ferramentas do agente Axionn (para ChatGPT/Claude/Manus via MCP/HTTP).
 * O chat interativo continua em POST /api/chat (auth Bearer + Supabase).
 */
const TOOLS = [
  {
    name: "resumo_financeiro",
    description: "Patrimônio, saldo por conta e taxa de poupança do mês corrente.",
    inputSchema: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "buscar_transacoes",
    description: "Busca transações por texto, categoria e período.",
    inputSchema: {
      type: "object",
      properties: {
        termo: { type: "string" },
        dataInicio: { type: "string", format: "date" },
        dataFim: { type: "string", format: "date" },
      },
      required: ["dataInicio", "dataFim"],
    },
  },
  {
    name: "status_orcamento",
    description: "Planejado x realizado por categoria no mês.",
    inputSchema: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "alertas_orcamento",
    description: "Categorias com 80%+ do limite utilizado ou estouradas.",
    inputSchema: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "alertas_contas",
    description: "Contas vencidas ou vencendo em até 3 dias.",
    inputSchema: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "projecao_fluxo_caixa",
    description: "Projeção de fluxo de caixa dos próximos meses.",
    inputSchema: {
      type: "object",
      properties: { meses: { type: "number" } },
      required: ["meses"],
    },
  },
  {
    name: "metas",
    description: "Metas financeiras com progresso e prazo.",
    inputSchema: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "calculate_tax_preview",
    description: "Prévia de IRPF do mês.",
    inputSchema: {
      type: "object",
      properties: { ano: { type: "number" }, mes: { type: "number" } },
      required: ["ano", "mes"],
    },
  },
  {
    name: "create_goal",
    description: "Cria uma nova meta financeira.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        valorAlvo: { type: "number" },
        prazo: { type: "string", format: "date" },
      },
      required: ["titulo", "valorAlvo"],
    },
  },
  {
    name: "schedule_pix_payment",
    description: "Agenda Pix (requer confirmação do usuário no chat).",
    inputSchema: {
      type: "object",
      properties: {
        valor: { type: "number" },
        destinatario: { type: "string" },
        data: { type: "string", format: "date" },
        contaId: { type: "string" },
      },
      required: ["valor", "destinatario"],
    },
  },
  {
    name: "upsert_memory",
    description: "Salva preferência/padrão do usuário.",
    inputSchema: {
      type: "object",
      properties: {
        conteudo: { type: "string" },
        tipo: { type: "string" },
        importancia: { type: "number" },
      },
      required: ["conteudo"],
    },
  },
  {
    name: "search_memories",
    description: "Busca memórias do usuário.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limite: { type: "number" } },
      required: ["query"],
    },
  },
] as const;

export const Route = createFileRoute("/api/agent-tools")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            agent: "Axionn",
            version: "1.0",
            chat: "/api/chat",
            auth: "Bearer <supabase access_token>",
            tools: TOOLS,
          },
          { headers: { "Cache-Control": "public, max-age=3600" } },
        );
      },
    },
  },
});
