import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { InvestmentProfile } from "@/lib/investment-radar";
import type {
  InvestmentPlanAllocation,
  InvestmentPlanScenario,
  SavedInvestmentPlan,
} from "@/lib/investment-plan";
import { shouldCreateRadarAlert } from "@/lib/investment-alerts";
import { calculateInvestmentPlanProgress } from "@/lib/investment-progress";
import { buildUserInvestmentRadar } from "@/lib/investment-radar-user.server";

type DatabaseClient = SupabaseClient<Database>;
type DbJson = Database["public"]["Tables"]["investment_radar_runs"]["Row"]["snapshot"];

type AlertPreferences = {
  enabled: boolean;
  inAppEnabled: boolean;
  minimumScore: number;
  scoreChangeThreshold: number;
  driftThreshold: number;
};

export type MonitoringResult = {
  userId: string;
  runDate: string;
  topOpportunity: string | null;
  topScore: number | null;
  insightsCreated: number;
  plansEvaluated: number;
  skipped: boolean;
};

const defaultPreferences: AlertPreferences = {
  enabled: true,
  inAppEnabled: true,
  minimumScore: 70,
  scoreChangeThreshold: 5,
  driftThreshold: 10,
};

async function loadPreferences(
  supabase: DatabaseClient,
  userId: string,
): Promise<AlertPreferences> {
  const { data, error } = await supabase
    .from("investment_alert_preferences")
    .select("enabled, in_app_enabled, minimum_score, score_change_threshold, drift_threshold")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaultPreferences;
  return {
    enabled: data.enabled,
    inAppEnabled: data.in_app_enabled,
    minimumScore: data.minimum_score,
    scoreChangeThreshold: data.score_change_threshold,
    driftThreshold: Number(data.drift_threshold),
  };
}

function mapPlan(
  plan: Database["public"]["Tables"]["investment_plans"]["Row"],
): SavedInvestmentPlan {
  return {
    id: plan.id,
    name: plan.name,
    input: {
      initialAmount: Number(plan.initial_amount),
      monthlyContribution: Number(plan.monthly_contribution),
      horizonMonths: plan.horizon_months,
    },
    allocations: plan.allocations as unknown as InvestmentPlanAllocation[],
    scenarios: plan.scenarios as unknown as InvestmentPlanScenario[],
    marketReferenceDate: plan.market_reference_date,
    profileSnapshot: plan.profile_snapshot as unknown as InvestmentProfile,
    archivedAt: plan.archived_at,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

async function upsertInsight(
  supabase: DatabaseClient,
  input: {
    userId: string;
    key: string;
    title: string;
    description: string;
    severity: "info" | "warning";
    metadata: DbJson;
  },
) {
  const { error } = await supabase.from("agent_insights").upsert(
    {
      user_id: input.userId,
      insight_key: input.key,
      title: input.title,
      description: input.description,
      severity: input.severity,
      metadata: input.metadata,
      record_origin: "system",
    },
    { onConflict: "user_id,insight_key" },
  );
  if (error) throw error;
}

export async function processInvestmentMonitoringForUser(
  supabase: DatabaseClient,
  userId: string,
  runDate = new Date().toISOString().slice(0, 10),
  force = false,
): Promise<MonitoringResult> {
  const preferences = await loadPreferences(supabase, userId);
  if (!preferences.enabled && !force) {
    return {
      userId,
      runDate,
      topOpportunity: null,
      topScore: null,
      insightsCreated: 0,
      plansEvaluated: 0,
      skipped: true,
    };
  }
  const radar = await buildUserInvestmentRadar(supabase, userId);
  const top = radar.opportunities[0];
  const { data: previousRun, error: previousError } = await supabase
    .from("investment_radar_runs")
    .select("top_opportunity_id, top_score")
    .eq("user_id", userId)
    .lt("run_date", runDate)
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) throw previousError;

  const { error: runError } = await supabase.from("investment_radar_runs").upsert(
    {
      user_id: userId,
      run_date: runDate,
      market_reference_date: radar.referenceDate,
      top_opportunity_id: top?.id ?? null,
      top_opportunity_name: top?.name ?? null,
      top_score: top?.score ?? null,
      snapshot: radar as unknown as DbJson,
      status: top
        ? radar.sourceHealth.some((source) => source.status === "unavailable")
          ? "partial"
          : "completed"
        : "failed",
      error_message: top ? null : "Nenhuma oportunidade elegível retornada pelo Radar.",
    },
    { onConflict: "user_id,run_date" },
  );
  if (runError) throw runError;

  let insightsCreated = 0;
  if (
    shouldCreateRadarAlert(
      preferences,
      top,
      previousRun
        ? {
            topOpportunityId: previousRun.top_opportunity_id,
            topScore: previousRun.top_score,
          }
        : null,
    ) &&
    top
  ) {
    await upsertInsight(supabase, {
      userId,
      key: `investment-radar:${runDate}`,
      title: `Radar do dia: ${top.name}`,
      description: `${top.summary} Pontuação ${top.score}/100, com taxa indicada de ${top.rateLabel}. Revise prazo, risco e preço na instituição antes de investir.`,
      severity: "info",
      metadata: {
        kind: "investment_radar",
        opportunity_id: top.id,
        score: top.score,
        reference_date: radar.referenceDate,
      },
    });
    insightsCreated += 1;
  }

  const [{ data: planRows, error: plansError }, { data: positionRows, error: positionsError }] =
    await Promise.all([
      supabase.from("investment_plans").select("*").eq("user_id", userId).is("archived_at", null),
      supabase
        .from("investment_positions")
        .select("id, ticker, name, quantity, current_price")
        .eq("user_id", userId)
        .is("archived_at", null),
    ]);
  if (plansError) throw plansError;
  if (positionsError) throw positionsError;

  const positions = (positionRows ?? []).map((position) => ({
    id: position.id,
    ticker: position.ticker,
    name: position.name,
    marketValue: Number(position.quantity) * Number(position.current_price),
  }));
  for (const row of planRows ?? []) {
    const progress = calculateInvestmentPlanProgress(mapPlan(row), positions);
    const { error: progressError } = await supabase
      .from("investment_plan_progress_snapshots")
      .upsert(
        {
          user_id: userId,
          plan_id: progress.planId,
          snapshot_date: runDate,
          actual_total: progress.actualTotal,
          overall_drift: progress.overallDrift,
          status: progress.status,
          details: progress as unknown as DbJson,
        },
        { onConflict: "plan_id,snapshot_date" },
      );
    if (progressError) throw progressError;

    if (
      preferences.enabled &&
      preferences.inAppEnabled &&
      progress.overallDrift >= preferences.driftThreshold
    ) {
      await upsertInsight(supabase, {
        userId,
        key: `investment-drift:${runDate}:${progress.planId}`,
        title: `Plano fora do alvo: ${progress.planName}`,
        description: `O desvio estimado chegou a ${progress.overallDrift.toFixed(1)} pontos. O próximo aporte pode priorizar as posições abaixo da meta, sem necessidade de venda automática.`,
        severity: "warning",
        metadata: {
          kind: "investment_plan_drift",
          plan_id: progress.planId,
          drift: progress.overallDrift,
        },
      });
      insightsCreated += 1;
    }
  }

  const { error: preferenceError } = await supabase.from("investment_alert_preferences").upsert({
    user_id: userId,
    last_evaluated_at: new Date().toISOString(),
  });
  if (preferenceError) throw preferenceError;

  return {
    userId,
    runDate,
    topOpportunity: top?.name ?? null,
    topScore: top?.score ?? null,
    insightsCreated,
    plansEvaluated: planRows?.length ?? 0,
    skipped: false,
  };
}
