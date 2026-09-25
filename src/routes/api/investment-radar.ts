import { createFileRoute } from "@tanstack/react-router";
import { createUserClient } from "@/infrastructure";

export const Route = createFileRoute("/api/investment-radar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const supabase = createUserClient(token);
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
