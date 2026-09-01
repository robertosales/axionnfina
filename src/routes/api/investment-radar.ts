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

export const Route = createFileRoute("/api/investment-radar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const supabase = userClient(token);
          const { data: userData, error: userError } = await supabase.auth.getUser(token);
          if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
          const { buildUserInvestmentRadar } = await import("@/lib/investment-radar-user.server");
          const response = await buildUserInvestmentRadar(supabase, userData.user.id);

          return Response.json(response, {
            headers: { "Cache-Control": "private, max-age=300" },
          });
        } catch (error) {
          console.error("[InvestmentRadar]", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Não foi possível atualizar o Radar de Investimentos.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
