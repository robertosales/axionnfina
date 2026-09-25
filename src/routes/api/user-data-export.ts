import { createFileRoute } from "@tanstack/react-router";

import { authenticateApi } from "@/lib/api-auth.server";
import { logEvent } from "@/lib/observability.server";

/**
 * GET /api/user-data-export
 * Exporta todos os dados pessoais do usuário (LGPD Art. 18).
 * Retorna um JSON com todos os dados associados à conta.
 */
export const Route = createFileRoute("/api/user-data-export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApi(request);
        if (!auth) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { client, user } = auth;

        try {
          // Buscar dados do perfil
          const { data: profile } = await client
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          // Buscar configurações de privacidade
          const { data: privacySettings } = await client
            .from("user_privacy_settings")
            .select("*")
            .eq("user_id", user.id)
            .single();

          // Buscar consentimentos
          const { data: consents } = await client
            .from("lgpd_consents")
            .select("purpose, status, description, granted_at, revoked_at")
            .eq("user_id", user.id);

          // Buscar contas bancárias
          const { data: accounts } = await client
            .from("accounts")
            .select("id, name, type, institution, balance, currency, created_at")
            .eq("user_id", user.id);

          // Buscar transações (últimos 12 meses para LGPD)
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

          const { data: transactions } = await client
            .from("transactions")
            .select("id, description, amount, category_id, posted_at, created_at")
            .eq("user_id", user.id)
            .gte("posted_at", twelveMonthsAgo.toISOString());

          // Buscar metas financeiras
          const { data: goals } = await client
            .from("financial_goals")
            .select("id, name, target_amount, current_amount, deadline, created_at")
            .eq("user_id", user.id);

          // Buscar dispositivos conectados
          const { data: devices } = await client
            .from("user_devices")
            .select("device_name, device_type, last_seen_at, created_at")
            .eq("user_id", user.id);

          // Buscar eventos de segurança (últimos 30 dias)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: securityEvents } = await client
            .from("security_events")
            .select("event_type, severity, ip_address, country, created_at")
            .eq("user_id", user.id)
            .gte("created_at", thirtyDaysAgo.toISOString());

          // Registrar solicitação de exportação
          await client.rpc("request_data_export");

          const exportData = {
            export_info: {
              generated_at: new Date().toISOString(),
              user_id: user.id,
              email: user.email,
              data_period: "Últimos 12 meses",
              lgpd_article: "Art. 18 - Direito de acesso aos dados",
            },
            profile,
            privacy_settings: privacySettings,
            consents,
            accounts,
            transactions,
            financial_goals: goals,
            connected_devices: devices,
            security_events: securityEvents,
          };

          logEvent("info", "lgpd.data_exported", {
            userId: user.id,
            recordCount: {
              accounts: accounts?.length ?? 0,
              transactions: transactions?.length ?? 0,
              goals: goals?.length ?? 0,
            },
          });

          return Response.json(exportData, {
            headers: {
              "Content-Type": "application/json",
              "Content-Disposition": `attachment; filename="axionnfina-dados-${user.id}.json"`,
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Pragma": "no-cache",
            },
          });
        } catch (error) {
          logEvent("error", "lgpd.export_failed", {
            userId: user.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          return Response.json(
            { error: "Não foi possível exportar os dados. Tente novamente." },
            { status: 500 },
          );
        }
      },
    },
  },
});
