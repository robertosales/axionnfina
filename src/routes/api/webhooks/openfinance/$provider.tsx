/**
 * Webhook endpoint para receber eventos de providers Open Finance.
 *
 * POST /api/webhooks/openfinance/:provider
 *
 * Regras:
 * - Retornar 200 rapidamente
 * - Não executar processamento pesado no handler
 * - Validar assinatura quando disponível
 * - Registrar evento para replay protection
 */

import { createFileRoute } from "@tanstack/react-router";
import { getOpenFinanceConfig } from "@/lib/openfinance-config";
import { readWebhookSecret, verifyWebhookSecret } from "@/lib/webhook-security";

export const Route = createFileRoute("/api/webhooks/openfinance/$provider")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { provider } = params;
        const config = getOpenFinanceConfig();

        // Feature flag check
        if (!config.enabled) {
          return new Response("Open Finance not enabled", { status: 503 });
        }

        // Validate provider
        if (provider !== "pluggy") {
          return new Response("Invalid provider", { status: 400 });
        }

        try {
          if (!config.webhookSecret) {
            console.error(`[Webhook:${provider}] PLUGGY_WEBHOOK_SECRET is not configured.`);
            return new Response("Webhook security is not configured", { status: 503 });
          }

          const providedSecret = readWebhookSecret(request.headers);
          if (!(await verifyWebhookSecret(providedSecret, config.webhookSecret))) {
            return new Response("Unauthorized", { status: 401 });
          }

          const payload = await request.json();

          // Await processing so a serverless runtime cannot terminate it early.
          const { handlePluggyWebhook } = await import("@/lib/openfinance-sync.server");
          await handlePluggyWebhook(payload);

          // Confirm only after the event is durably processed.
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error(`[Webhook:${provider}] Parse error:`, err);
          return new Response("Invalid payload", { status: 400 });
        }
      },
    },
  },
});
