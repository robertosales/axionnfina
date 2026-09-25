import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApi } from "@/lib/api-auth.server";
import { logEvent } from "@/lib/observability.server";

const deletionRequestSchema = z.object({
  reason: z.string().optional(),
  confirm_email: z.string().email(),
});

/**
 * POST /api/user-account-deletion
 * Solicita exclusão de conta (LGPD Art. 18, VI - Direito ao esquecimento).
 * Não exclui imediatamente - cria uma solicitação pendente de revisão.
 */
export const Route = createFileRoute("/api/user-account-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateApi(request);
        if (!auth) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { client, user } = auth;

        try {
          const body = await request.json();
          const parsed = deletionRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Dados inválidos. Confirme seu email para prosseguir." },
              { status: 400 },
            );
          }

          const { reason, confirm_email } = parsed.data;

          // Verificar se o email confere
          if (confirm_email !== user.email) {
            return Response.json(
              { error: "O email informado não corresponde à sua conta." },
              { status: 400 },
            );
          }

          // Verificar se já existe uma solicitação pendente
          const { data: existingRequest } = await client
            .from("lgpd_data_requests")
            .select("id, status")
            .eq("user_id", user.id)
            .eq("request_type", "deletion")
            .eq("status", "pending")
            .maybeSingle();

          if (existingRequest) {
            return Response.json(
              { error: "Você já possui uma solicitação de exclusão pendente." },
              { status: 409 },
            );
          }

          // Criar solicitação de exclusão via RPC
          const { data: requestId, error: rpcError } = await client.rpc(
            "request_account_deletion",
            { p_reason: reason },
          );

          if (rpcError) {
            throw new Error(rpcError.message);
          }

          logEvent("info", "lgpd.deletion_requested", {
            userId: user.id,
            requestId,
            reason,
          });

          return Response.json({
            success: true,
            request_id: requestId,
            message:
              "Solicitação de exclusão registrada. Nossa equipe analisará em até 15 dias úteis. Você receberá uma confirmação por email.",
            estimated_completion: new Date(
              Date.now() + 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          });
        } catch (error) {
          logEvent("error", "lgpd.deletion_failed", {
            userId: user.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          return Response.json(
            { error: "Não foi possível processar a solicitação. Tente novamente." },
            { status: 500 },
          );
        }
      },
    },
  },
});
