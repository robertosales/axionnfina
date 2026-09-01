import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

import type { Database } from "@/integrations/supabase/types";

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase não configurado no servidor.");

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

function brazilRunDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function secretsMatch(candidate: string, expected: string) {
  const encoder = new TextEncoder();
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

export const Route = createFileRoute("/api/investment-radar-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const cronSecret = process.env["INVESTMENT_RADAR_CRON_SECRET"];
          const isCron = Boolean(cronSecret) && (await secretsMatch(token, cronSecret!));
          const runDate = brazilRunDate();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { processInvestmentMonitoringForUser } =
            await import("@/lib/investment-monitoring.server");

          if (!isCron) {
            const authClient = userClient(token);
            const { data, error } = await authClient.auth.getUser(token);
            if (error || !data.user) return new Response("Unauthorized", { status: 401 });

            const result = await processInvestmentMonitoringForUser(
              supabaseAdmin,
              data.user.id,
              runDate,
              true,
            );
            return Response.json({ mode: "user", result });
          }

          const { data: profiles, error: profilesError } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .order("id");
          if (profilesError) throw profilesError;

          const results: Awaited<ReturnType<typeof processInvestmentMonitoringForUser>>[] = [];
          const failures: Array<{ userId: string; error: string }> = [];
          const users = profiles ?? [];
          const concurrency = 4;
          for (let index = 0; index < users.length; index += concurrency) {
            const batch = users.slice(index, index + concurrency);
            const settled = await Promise.allSettled(
              batch.map((profile) =>
                processInvestmentMonitoringForUser(supabaseAdmin, profile.id, runDate),
              ),
            );
            settled.forEach((result, resultIndex) => {
              const profile = batch[resultIndex];
              if (!profile) return;
              if (result.status === "fulfilled") results.push(result.value);
              else
                failures.push({
                  userId: profile.id,
                  error:
                    result.reason instanceof Error
                      ? result.reason.message
                      : "Falha desconhecida no monitoramento.",
                });
            });
          }

          return Response.json({
            mode: "cron",
            runDate,
            processed: results.filter((result) => !result.skipped).length,
            skipped: results.filter((result) => result.skipped).length,
            failed: failures.length,
            results,
            failures,
          });
        } catch (error) {
          console.error("[InvestmentRadarDaily]", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Não foi possível executar o monitoramento de investimentos.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
