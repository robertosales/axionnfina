import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

import type { Database } from "@/integrations/supabase/types";
import {
  INVESTMENT_OBJECTIVES,
  LIQUIDITY_PREFERENCES,
  RISK_PROFILES,
  rankTreasuryOpportunities,
  type InvestmentObjective,
  type InvestmentProfile,
  type InvestmentRadarContext,
  type InvestmentRadarResponse,
  type LiquidityPreference,
  type RiskProfile,
} from "@/lib/investment-radar";

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

function includesValue<T extends string>(values: readonly T[], value: string | null): value is T {
  return value != null && values.includes(value as T);
}

function monthsUntil(date: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(`${date}T12:00:00Z`).getTime() - Date.now()) / 2_629_746_000),
  );
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
          const userId = userData.user.id;

          const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          const [profileResult, accountsResult, expensesResult, goalsResult] = await Promise.all([
            supabase
              .from("profiles")
              .select(
                "risk_profile, investment_horizon_months, liquidity_preference, investment_objective",
              )
              .eq("id", userId)
              .maybeSingle(),
            supabase
              .from("accounts")
              .select("type, balance")
              .eq("user_id", userId)
              .is("archived_at", null),
            supabase
              .from("transactions")
              .select("amount")
              .eq("user_id", userId)
              .eq("type", "expense")
              .is("archived_at", null)
              .gte("occurred_at", ninetyDaysAgo),
            supabase
              .from("goals")
              .select("deadline")
              .eq("user_id", userId)
              .is("archived_at", null)
              .not("deadline", "is", null),
          ]);

          if (profileResult.error) throw profileResult.error;
          const row = profileResult.data;
          const riskValue = row?.risk_profile ?? null;
          const liquidityValue = row?.liquidity_preference ?? null;
          const objectiveValue = row?.investment_objective ?? null;
          const riskProfile: RiskProfile = includesValue(RISK_PROFILES, riskValue)
            ? riskValue
            : "conservative";
          const liquidityPreference: LiquidityPreference = includesValue(
            LIQUIDITY_PREFERENCES,
            liquidityValue,
          )
            ? liquidityValue
            : "daily";
          const objective: InvestmentObjective = includesValue(
            INVESTMENT_OBJECTIVES,
            objectiveValue,
          )
            ? objectiveValue
            : "reserve";
          const profile: InvestmentProfile = {
            riskProfile,
            horizonMonths: row?.investment_horizon_months ?? 24,
            liquidityPreference,
            objective,
          };

          const liquidBalance = (accountsResult.data ?? [])
            .filter((account) => account.type === "checking" || account.type === "savings")
            .reduce((sum, account) => sum + Math.max(0, Number(account.balance)), 0);
          const monthlyExpenses =
            (expensesResult.data ?? []).reduce(
              (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
              0,
            ) / 3;
          const goalMonths = (goalsResult.data ?? [])
            .map((goal) => (goal.deadline ? monthsUntil(goal.deadline) : null))
            .filter((value): value is number => value != null);
          const context: InvestmentRadarContext = {
            reserveMonths:
              monthlyExpenses > 0 ? Math.round((liquidBalance / monthlyExpenses) * 10) / 10 : null,
            monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
            liquidBalance: Math.round(liquidBalance * 100) / 100,
            nearestGoalMonths: goalMonths.length > 0 ? Math.min(...goalMonths) : null,
          };

          const { getMarketSnapshot } = await import("@/lib/investment-market.server");
          const { snapshot, cacheStatus } = await getMarketSnapshot();
          const response: InvestmentRadarResponse = {
            generatedAt: new Date().toISOString(),
            referenceDate:
              snapshot.opportunities[0]?.referenceDate ?? snapshot.fetchedAt.slice(0, 10),
            cacheStatus,
            profile,
            context,
            indicators: snapshot.indicators,
            opportunities: rankTreasuryOpportunities(
              snapshot.opportunities,
              profile,
              snapshot.indicators,
              context,
            ),
            sourceHealth: snapshot.sourceHealth,
            disclaimer:
              "Conteúdo educacional baseado em dados públicos. Não constitui recomendação, oferta ou análise individual regulada. Confirme preços, custos, tributação e suitability na instituição antes de investir.",
          };

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
