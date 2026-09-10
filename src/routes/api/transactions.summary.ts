import { createFileRoute } from "@tanstack/react-router";
import { authenticateApi } from "@/lib/api-auth.server";
export const Route = createFileRoute("/api/transactions/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApi(request);
        if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401 });
        const url = new URL(request.url);
        const start =
          url.searchParams.get("start_date") ??
          new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const end = url.searchParams.get("end_date") ?? new Date().toISOString().slice(0, 10);
        if (
          ![start, end].every(
            (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)),
          ) ||
          start > end
        )
          return Response.json({ error: "Período inválido" }, { status: 400 });
        const { data, error } = await auth.client.rpc("get_transactions_summary", {
          p_start_date: start,
          p_end_date: end,
        });
        return Response.json(error ? { error: "Falha ao carregar resumo" } : data, {
          status: error ? 400 : 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
