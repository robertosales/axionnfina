import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateApi } from "@/lib/api-auth.server";

const manual = z.object({
  account_id: z.string().uuid(),
  amount: z
    .number()
    .finite()
    .refine((n) => n !== 0),
  description: z.string().min(1).max(200),
  category: z.string().default("Outros"),
  posted_at: z.string().datetime(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
});
export const Route = createFileRoute("/api/transactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApi(request);
        if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401 });
        const { data, error } = await auth.client
          .from("transactions")
          .select("*")
          .eq("user_id", auth.user.id)
          .is("archived_at", null)
          .order("occurred_at", { ascending: false })
          .limit(200);
        return Response.json(
          error ? { error: "Falha ao listar transações" } : { transactions: data },
          { status: error ? 400 : 200, headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const auth = await authenticateApi(request);
        if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401 });
        try {
          const action = new URL(request.url).searchParams.get("action");
          const body: unknown = await request.json();
          if (action === "create") {
            const input = manual.parse(body);
            const { data, error } = await auth.client.rpc("create_manual_transaction", {
              p_data: {
                ...input,
                occurred_at: input.posted_at.slice(0, 10),
                type: input.type ?? (input.amount > 0 ? "income" : "expense"),
              },
            });
            return Response.json(
              error ? { error: "Não foi possível criar a transação" } : { id: data },
              { status: error ? 400 : 201 },
            );
          }
          if (action === "pair-transfer") {
            const input = z
              .object({
                debit_transaction_id: z.string().uuid(),
                credit_transaction_id: z.string().uuid(),
              })
              .parse(body);
            const { data, error } = await auth.client.rpc("pair_transfer", {
              p_debit_transaction_id: input.debit_transaction_id,
              p_credit_transaction_id: input.credit_transaction_id,
              p_is_manual: true,
            });
            return Response.json(
              error ? { error: "Não foi possível parear as transações" } : { pair_id: data },
              { status: error ? 400 : 200 },
            );
          }
          if (action === "categorize") {
            const input = z
              .object({ transaction_id: z.string().uuid(), category: z.string().min(1).max(100) })
              .parse(body);
            const { error } = await auth.client.rpc("edit_transaction", {
              p_id: input.transaction_id,
              p_changes: { category: input.category },
            });
            return Response.json(
              error ? { error: "Não foi possível categorizar" } : { success: true },
              { status: error ? 400 : 200 },
            );
          }
          return Response.json({ error: "Ação inválida" }, { status: 400 });
        } catch {
          return Response.json({ error: "Dados inválidos" }, { status: 400 });
        }
      },
    },
  },
});
