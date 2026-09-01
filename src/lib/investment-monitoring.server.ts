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
import { buildMaturityLadder } from "@/lib/investment-maturity";
import { buildUserInvestmentRadar } from "@/lib/investment-radar-user.server";
import { calculateFgcExposure, FGC_ORDINARY_LIMIT } from "@/lib/fgc-exposure";
import {
  rankPrivateOffers,
  type PrivateFixedIncomeOffer,
  type PrivateProductType,
  type PrivateRateType,
} from "@/lib/private-fixed-income";

type DatabaseClient = SupabaseClient<Database>;
type DbJson = Database["public"]["Tables"]["investment_radar_runs"]["Row"]["snapshot"];

type AlertPreferences = {
  enabled: boolean;
  inAppEnabled: boolean;
  minimumScore: number;
  scoreChangeThreshold: number;
  driftThreshold: number;
  privateComparisonAmount: number;
  privateOfferMaxAgeDays: number;
  maturityAlertDays: number;
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
  privateComparisonAmount: 10_000,
  privateOfferMaxAgeDays: 7,
  maturityAlertDays: 30,
};

async function loadPreferences(
  supabase: DatabaseClient,
  userId: string,
): Promise<AlertPreferences> {
  const { data, error } = await supabase
    .from("investment_alert_preferences")
    .select(
      "enabled, in_app_enabled, minimum_score, score_change_threshold, drift_threshold, private_comparison_amount, private_offer_max_age_days, maturity_alert_days",
    )
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
    privateComparisonAmount: Number(data.private_comparison_amount),
    privateOfferMaxAgeDays: data.private_offer_max_age_days,
    maturityAlertDays: data.maturity_alert_days,
  };
}

function mapPrivateOffer(
  offer: Database["public"]["Tables"]["private_fixed_income_offers"]["Row"],
): PrivateFixedIncomeOffer {
  return {
    id: offer.id,
    institution: offer.institution,
    conglomerate: offer.conglomerate,
    productType: offer.product_type as PrivateProductType,
    rateType: offer.rate_type as PrivateRateType,
    rateValue: Number(offer.rate_value),
    referenceRate: offer.reference_rate == null ? null : Number(offer.reference_rate),
    minimumInvestment: Number(offer.minimum_investment),
    maturityDate: offer.maturity_date,
    dailyLiquidity: offer.daily_liquidity,
    fgcEligible: offer.fgc_eligible,
    sourceUrl: offer.source_url,
    sourceCheckedAt: offer.source_checked_at,
    notes: offer.notes,
    archivedAt: offer.archived_at,
    recordOrigin: offer.record_origin as PrivateFixedIncomeOffer["recordOrigin"],
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
  const { data, error } = await supabase
    .from("agent_insights")
    .upsert(
      {
        user_id: input.userId,
        insight_key: input.key,
        title: input.title,
        description: input.description,
        severity: input.severity,
        metadata: input.metadata,
        record_origin: "system",
      },
      { onConflict: "user_id,insight_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
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
  const [previousResult, privateOffersResult] = await Promise.all([
    supabase
      .from("investment_radar_runs")
      .select("top_opportunity_id, top_score, private_top_offer_id, private_top_score")
      .eq("user_id", userId)
      .lt("run_date", runDate)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("private_fixed_income_offers")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null),
  ]);
  const { data: previousRun, error: previousError } = previousResult;
  if (previousError) throw previousError;
  if (privateOffersResult.error) throw privateOffersResult.error;
  const topPrivate = rankPrivateOffers(
    (privateOffersResult.data ?? []).map(mapPrivateOffer),
    radar.profile,
    preferences.privateComparisonAmount,
    runDate,
    preferences.privateOfferMaxAgeDays,
  ).find((offer) => offer.eligible);

  const { error: runError } = await supabase.from("investment_radar_runs").upsert(
    {
      user_id: userId,
      run_date: runDate,
      market_reference_date: radar.referenceDate,
      top_opportunity_id: top?.id ?? null,
      top_opportunity_name: top?.name ?? null,
      top_score: top?.score ?? null,
      private_top_offer_id: topPrivate?.id ?? null,
      private_top_offer_name: topPrivate
        ? `${topPrivate.productType.toUpperCase()} ${topPrivate.institution}`
        : null,
      private_top_score: topPrivate?.score ?? null,
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
    const created = await upsertInsight(supabase, {
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
    if (created) insightsCreated += 1;
  }

  if (
    shouldCreateRadarAlert(
      preferences,
      topPrivate,
      previousRun
        ? {
            topOpportunityId: previousRun.private_top_offer_id,
            topScore: previousRun.private_top_score,
          }
        : null,
    ) &&
    topPrivate
  ) {
    const created = await upsertInsight(supabase, {
      userId,
      key: `private-fixed-income:${runDate}`,
      title: `Oferta privada em destaque: ${topPrivate.productType.toUpperCase()} ${topPrivate.institution}`,
      description: `Para ${preferences.privateComparisonAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, o retorno líquido anual estimado é ${(topPrivate.netAnnualRate * 100).toFixed(2)}%. Taxa conferida há ${topPrivate.sourceAgeDays} dia(s); confirme disponibilidade, conglomerado e condições antes de investir.`,
      severity: "info",
      metadata: {
        kind: "private_fixed_income",
        offer_id: topPrivate.id,
        score: topPrivate.score,
        net_annual_rate: topPrivate.netAnnualRate,
        source_checked_at: topPrivate.sourceCheckedAt,
      },
    });
    if (created) insightsCreated += 1;
  }

  const [{ data: planRows, error: plansError }, { data: positionRows, error: positionsError }] =
    await Promise.all([
      supabase.from("investment_plans").select("*").eq("user_id", userId).is("archived_at", null),
      supabase
        .from("investment_positions")
        .select(
          "id, ticker, name, quantity, current_price, conglomerate, fgc_eligible, maturity_date",
        )
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
  const fgcSummary = calculateFgcExposure(
    (positionRows ?? []).map((position) => ({
      id: position.id,
      name: position.name,
      marketValue: Number(position.quantity) * Number(position.current_price),
      conglomerate: position.conglomerate,
      fgcEligible: position.fgc_eligible,
    })),
  );
  const topFgcExposure = fgcSummary.groups[0];
  if (
    preferences.enabled &&
    preferences.inAppEnabled &&
    topFgcExposure &&
    topFgcExposure.status !== "safe"
  ) {
    const created = await upsertInsight(supabase, {
      userId,
      key: `fgc-exposure:${runDate}:${topFgcExposure.conglomerate.toLowerCase()}`,
      title: `Concentração FGC: ${topFgcExposure.conglomerate}`,
      description:
        topFgcExposure.uncoveredAmount > 0
          ? `A exposição registrada é ${topFgcExposure.projectedExposure.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, ficando ${topFgcExposure.uncoveredAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} acima da referência ordinária de ${FGC_ORDINARY_LIMIT.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por conglomerado.`
          : `A exposição registrada atingiu ${(topFgcExposure.utilization * 100).toFixed(0)}% da referência ordinária do FGC por conglomerado. Revise o saldo total antes do próximo aporte.`,
      severity: "warning",
      metadata: {
        kind: "fgc_exposure",
        conglomerate: topFgcExposure.conglomerate,
        current_exposure: topFgcExposure.currentExposure,
        uncovered_amount: topFgcExposure.uncoveredAmount,
      },
    });
    if (created) insightsCreated += 1;
  }
  const maturityLadder = buildMaturityLadder(
    (positionRows ?? []).map((position) => ({
      id: position.id,
      ticker: position.ticker,
      name: position.name,
      marketValue: Number(position.quantity) * Number(position.current_price),
      maturityDate: position.maturity_date,
    })),
    runDate,
    preferences.maturityAlertDays,
  );
  const maturityAlerts = maturityLadder.items.filter(
    (item) => item.status === "overdue" || item.status === "upcoming",
  );
  if (preferences.enabled && preferences.inAppEnabled && maturityAlerts.length > 0) {
    const next = maturityAlerts[0]!;
    const total = maturityAlerts.reduce((sum, item) => sum + item.marketValue, 0);
    const created = await upsertInsight(supabase, {
      userId,
      key: `investment-maturity:${runDate}`,
      title:
        next.status === "overdue"
          ? `Vencimento pendente: ${next.ticker}`
          : `Vencimento próximo: ${next.ticker}`,
      description: `${maturityAlerts.length} posição(ões), somando ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} pelo valor atual cadastrado, exigem revisão. O evento mais próximo é ${next.name}, em ${next.maturityDate}. Confirme liquidação e condições na instituição; não há reinvestimento automático.`,
      severity: next.status === "overdue" ? "warning" : "info",
      metadata: {
        kind: "investment_maturity",
        position_id: next.id,
        maturity_date: next.maturityDate,
        days_until_maturity: next.daysUntilMaturity,
        positions_count: maturityAlerts.length,
        current_value_total: total,
      },
    });
    if (created) insightsCreated += 1;
  }
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
      const created = await upsertInsight(supabase, {
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
      if (created) insightsCreated += 1;
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
