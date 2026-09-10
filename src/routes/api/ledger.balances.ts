import { createFileRoute } from "@tanstack/react-router";
import { authenticateApi } from "@/lib/api-auth.server";
export const Route = createFileRoute("/api/ledger/balances")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApi(request);
        if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401 });
        const date =
          new URL(request.url).searchParams.get("as_of_date") ??
          new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
          return Response.json({ error: "Data inválida" }, { status: 400 });
        const { data, error } = await auth.client.rpc("get_ledger_balances", {
          p_as_of_date: date,
        });
        return Response.json(error ? { error: "Falha ao carregar saldos" } : data, {
          status: error ? 400 : 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
