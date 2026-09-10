import { supabase } from "@/integrations/supabase/client";
import type { FirstInvestmentAnswers, FirstInvestmentGuidance } from "@/lib/first-investment-guide";
import type { CsvInvestmentRow } from "@/lib/investment-import";
import type {
  InvestmentPlanAllocation,
  InvestmentPlanScenario,
  InvestmentPlanSimulation,
  SavedInvestmentPlan,
} from "@/lib/investment-plan";
import type {
  InvestmentObjective,
  InvestmentProfile,
  InvestmentRadarResponse,
  LiquidityPreference,
  RiskProfile,
} from "@/lib/investment-radar";
import type {
  PrivateFixedIncomeOffer,
  PrivateProductType,
  PrivateRateType,
} from "@/lib/private-fixed-income";
import type { AssetClass } from "@/shared/domain";
import { ASSET_CLASS_COLOR, ASSET_CLASS_LABEL } from "@/shared/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DbJson, requireUserId } from "./common";

export type Position = {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profit: number;
  privateProductType: PrivateProductType | null;
  institution: string | null;
  conglomerate: string | null;
  maturityDate: string | null;
  fgcEligible: boolean | null;
  archivedAt: string | null;
  recordOrigin: "manual" | "open_finance" | "import" | "system";
  source: "manual" | "open_finance" | "csv" | "pdf";
  lastSyncedAt: string | null;
};

export function useInvestments(showArchived = false) {
  const query = useQuery({
    queryKey: ["investments", showArchived],
    queryFn: async (): Promise<Position[]> => {
      let request = supabase
        .from("investment_positions")
        .select(
          "id, ticker, name, asset_class, quantity, average_price, current_price, private_product_type, institution, conglomerate, maturity_date, fgc_eligible, archived_at, record_origin, source, last_synced_at",
        )
        .order("ticker", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => {
        const quantity = Number(row.quantity);
        const averagePrice = Number(row.average_price);
        const currentPrice = Number(row.current_price);
        return {
          id: row.id,
          ticker: row.ticker,
          name: row.name,
          assetClass: row.asset_class as AssetClass,
          quantity,
          averagePrice,
          currentPrice,
          marketValue: quantity * currentPrice,
          profit: quantity * (currentPrice - averagePrice),
          privateProductType: row.private_product_type as PrivateProductType | null,
          institution: row.institution,
          conglomerate: row.conglomerate,
          maturityDate: row.maturity_date,
          fgcEligible: row.fgc_eligible,
          archivedAt: row.archived_at,
          recordOrigin: row.record_origin as Position["recordOrigin"],
          source: row.source as Position["source"],
          lastSyncedAt: row.last_synced_at,
        };
      });
    },
  });

  const positions = query.data ?? [];
  const total = positions.reduce((sum, p) => sum + p.marketValue, 0);

  const byClass = new Map<AssetClass, number>();
  for (const p of positions)
    byClass.set(p.assetClass, (byClass.get(p.assetClass) ?? 0) + p.marketValue);

  const allocation = [...byClass.entries()].map(([assetClass, value]) => ({
    name: ASSET_CLASS_LABEL[assetClass],
    value,
    token: ASSET_CLASS_COLOR[assetClass],
  }));

  return { ...query, positions, allocation, total };
}

export function useUpsertInvestmentPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      ticker: string;
      name: string;
      assetClass: AssetClass;
      quantity: number;
      averagePrice: number;
      currentPrice: number;
      privateProductType?: PrivateProductType | null;
      institution?: string | null;
      conglomerate?: string | null;
      maturityDate?: string | null;
      fgcEligible?: boolean | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        ticker: input.ticker.toUpperCase(),
        name: input.name,
        asset_class: input.assetClass,
        quantity: input.quantity,
        average_price: input.averagePrice,
        current_price: input.currentPrice,
        private_product_type: input.privateProductType ?? null,
        institution: input.institution?.trim() || null,
        conglomerate: input.conglomerate?.trim() || null,
        maturity_date: input.maturityDate || null,
        fgc_eligible: input.fgcEligible ?? null,
        record_origin: "manual",
        source: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("investment_positions").update(payload).eq("id", input.id)
        : await supabase.from("investment_positions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useImportInvestmentPositions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fileName: string; rows: CsvInvestmentRow[] }) => {
      const userId = await requireUserId();
      const valid = input.rows.filter((row) => row.valid);
      const { data: batch, error: batchError } = await supabase
        .from("investment_import_batches")
        .insert({
          user_id: userId,
          file_name: input.fileName,
          file_type: "csv",
          status: "staged",
          rows_found: input.rows.length,
          rows_rejected: input.rows.length - valid.length,
          errors: input.rows
            .filter((row) => !row.valid)
            .map((row) => ({ row: row.rowNumber, errors: row.errors })) as unknown as DbJson,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      const { error } = await supabase.from("investment_positions").upsert(
        valid.map((row) => ({
          user_id: userId,
          ticker: row.ticker,
          name: row.name,
          asset_class: row.assetClass,
          quantity: row.quantity,
          average_price: row.averagePrice,
          current_price: row.currentPrice,
          institution: row.institution,
          maturity_date: row.maturityDate,
          private_product_type: row.privateProductType,
          fgc_eligible: row.fgcEligible,
          external_id: row.externalId,
          source: "csv",
          source_file_name: input.fileName,
          provider_balance: row.marketValue,
          raw_data: row as unknown as DbJson,
          record_origin: "import",
          archived_at: null,
        })),
        { onConflict: "user_id,source,external_id" },
      );
      if (error) {
        await supabase
          .from("investment_import_batches")
          .update({ status: "failed" })
          .eq("id", batch.id);
        throw error;
      }
      await supabase
        .from("investment_import_batches")
        .update({
          status: "completed",
          rows_imported: valid.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
      return { imported: valid.length, rejected: input.rows.length - valid.length };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useInvestmentRadar() {
  return useQuery({
    queryKey: ["investment-radar"],
    queryFn: async (): Promise<InvestmentRadarResponse> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const response = await fetch("/api/investment-radar", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as InvestmentRadarResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar o Radar.");
      return payload;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateInvestmentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: InvestmentProfile) => {
      const userId = await requireUserId();
      const payload: {
        risk_profile: RiskProfile;
        investment_horizon_months: number;
        liquidity_preference: LiquidityPreference;
        investment_objective: InvestmentObjective;
      } = {
        risk_profile: profile.riskProfile,
        investment_horizon_months: profile.horizonMonths,
        liquidity_preference: profile.liquidityPreference,
        investment_objective: profile.objective,
      };
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...payload });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investment-radar"] }),
  });
}

export type SavedInvestmentGuidance = {
  answers: FirstInvestmentAnswers;
  createdAt: string;
};

export function useLatestInvestmentGuidance() {
  return useQuery({
    queryKey: ["investment-guidance", "latest"],
    queryFn: async (): Promise<SavedInvestmentGuidance | null> => {
      const { data, error } = await supabase
        .from("investment_guidance_assessments")
        .select(
          "objective, horizon_months, liquidity_preference, fluctuation_tolerance, knowledge_level, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        answers: {
          objective: data.objective as InvestmentObjective,
          horizonMonths: data.horizon_months,
          liquidityPreference: data.liquidity_preference as LiquidityPreference,
          fluctuationTolerance:
            data.fluctuation_tolerance as FirstInvestmentAnswers["fluctuationTolerance"],
          knowledgeLevel: data.knowledge_level as FirstInvestmentAnswers["knowledgeLevel"],
        },
        createdAt: data.created_at,
      };
    },
    retry: false,
  });
}

export function useSaveInvestmentGuidance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      answers: FirstInvestmentAnswers;
      guidance: FirstInvestmentGuidance;
      financial: { stage: string; confidence: number; metrics: Record<string, number> };
    }) => {
      const userId = await requireUserId();
      const completedAt = new Date().toISOString();
      const { error: assessmentError } = await supabase
        .from("investment_guidance_assessments")
        .insert({
          user_id: userId,
          objective: input.answers.objective,
          horizon_months: input.answers.horizonMonths,
          liquidity_preference: input.answers.liquidityPreference,
          fluctuation_tolerance: input.answers.fluctuationTolerance,
          knowledge_level: input.answers.knowledgeLevel,
          derived_risk_profile: input.guidance.profile.riskProfile,
          readiness: input.guidance.readiness,
          financial_snapshot: input.financial as unknown as DbJson,
          educational_paths: input.guidance.paths as unknown as DbJson,
          created_at: completedAt,
        });
      if (assessmentError) throw assessmentError;

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        risk_profile: input.guidance.profile.riskProfile,
        investment_horizon_months: input.answers.horizonMonths,
        liquidity_preference: input.answers.liquidityPreference,
        investment_objective: input.answers.objective,
        investment_knowledge: input.answers.knowledgeLevel,
        fluctuation_tolerance: input.answers.fluctuationTolerance,
        investment_guidance_completed_at: completedAt,
      });
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investment-guidance"] });
      void queryClient.invalidateQueries({ queryKey: ["investment-radar"] });
    },
  });
}

export function useInvestmentPlans(showArchived = false) {
  return useQuery({
    queryKey: ["investment-plans", showArchived],
    queryFn: async (): Promise<SavedInvestmentPlan[]> => {
      let request = supabase
        .from("investment_plans")
        .select(
          "id, name, initial_amount, monthly_contribution, horizon_months, market_reference_date, profile_snapshot, allocations, scenarios, archived_at, created_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((plan) => ({
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
      }));
    },
  });
}

export function usePrivateFixedIncomeOffers(showArchived = false) {
  return useQuery({
    queryKey: ["private-fixed-income-offers", showArchived],
    queryFn: async (): Promise<PrivateFixedIncomeOffer[]> => {
      let request = supabase
        .from("private_fixed_income_offers")
        .select("*")
        .order("maturity_date", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((offer) => ({
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
      }));
    },
  });
}

export function useUpsertPrivateFixedIncomeOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<PrivateFixedIncomeOffer, "id" | "archivedAt" | "recordOrigin"> & {
        id?: string;
      },
    ) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        institution: input.institution.trim(),
        conglomerate: input.conglomerate.trim(),
        product_type: input.productType,
        rate_type: input.rateType,
        rate_value: input.rateValue,
        reference_rate: input.rateType === "fixed" ? null : input.referenceRate,
        minimum_investment: input.minimumInvestment,
        maturity_date: input.maturityDate,
        daily_liquidity: input.dailyLiquidity,
        fgc_eligible: input.fgcEligible,
        source_url: input.sourceUrl?.trim() || null,
        source_checked_at: input.sourceCheckedAt,
        notes: input.notes?.trim() || null,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("private_fixed_income_offers").update(payload).eq("id", input.id)
        : await supabase.from("private_fixed_income_offers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["private-fixed-income-offers"] }),
  });
}

export type InvestmentAlertPreferences = {
  enabled: boolean;
  inAppEnabled: boolean;
  minimumScore: number;
  scoreChangeThreshold: number;
  driftThreshold: number;
  privateComparisonAmount: number;
  privateOfferMaxAgeDays: number;
  maturityAlertDays: number;
  lastEvaluatedAt: string | null;
};

export const DEFAULT_INVESTMENT_ALERT_PREFERENCES: InvestmentAlertPreferences = {
  enabled: true,
  inAppEnabled: true,
  minimumScore: 70,
  scoreChangeThreshold: 5,
  driftThreshold: 10,
  privateComparisonAmount: 10_000,
  privateOfferMaxAgeDays: 7,
  maturityAlertDays: 30,
  lastEvaluatedAt: null,
};

export function useInvestmentAlertPreferences() {
  return useQuery({
    queryKey: ["investment-alert-preferences"],
    queryFn: async (): Promise<InvestmentAlertPreferences> => {
      const { data, error } = await supabase
        .from("investment_alert_preferences")
        .select(
          "enabled, in_app_enabled, minimum_score, score_change_threshold, drift_threshold, private_comparison_amount, private_offer_max_age_days, maturity_alert_days, last_evaluated_at",
        )
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_INVESTMENT_ALERT_PREFERENCES;
      return {
        enabled: data.enabled,
        inAppEnabled: data.in_app_enabled,
        minimumScore: data.minimum_score,
        scoreChangeThreshold: data.score_change_threshold,
        driftThreshold: Number(data.drift_threshold),
        privateComparisonAmount: Number(data.private_comparison_amount),
        privateOfferMaxAgeDays: data.private_offer_max_age_days,
        maturityAlertDays: data.maturity_alert_days,
        lastEvaluatedAt: data.last_evaluated_at,
      };
    },
  });
}

export function useUpdateInvestmentAlertPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: Omit<InvestmentAlertPreferences, "lastEvaluatedAt">) => {
      const userId = await requireUserId();
      const { error } = await supabase.from("investment_alert_preferences").upsert({
        user_id: userId,
        enabled: preferences.enabled,
        in_app_enabled: preferences.inAppEnabled,
        minimum_score: preferences.minimumScore,
        score_change_threshold: preferences.scoreChangeThreshold,
        drift_threshold: preferences.driftThreshold,
        private_comparison_amount: preferences.privateComparisonAmount,
        private_offer_max_age_days: preferences.privateOfferMaxAgeDays,
        maturity_alert_days: preferences.maturityAlertDays,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["investment-alert-preferences"] }),
  });
}

export function useRunInvestmentMonitoring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await fetch("/api/investment-radar-daily", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: { insightsCreated: number; plansEvaluated: number };
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a análise.");
      return payload.result;
    },
    onSuccess: () => {
      for (const queryKey of [
        "investment-radar",
        "investment-radar-runs",
        "investment-plan-progress",
        "investment-alert-preferences",
        "insights",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    },
  });
}

export function useInvestmentProgressHistory(planId?: string) {
  return useQuery({
    queryKey: ["investment-plan-progress", planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_plan_progress_snapshots")
        .select("snapshot_date, overall_drift, status, actual_total")
        .eq("plan_id", planId!)
        .order("snapshot_date", { ascending: true })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((snapshot) => ({
        date: snapshot.snapshot_date,
        drift: Number(snapshot.overall_drift),
        status: snapshot.status,
        actualTotal: Number(snapshot.actual_total),
      }));
    },
  });
}

export function useUpsertInvestmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      simulation: InvestmentPlanSimulation;
      marketReferenceDate: string;
      profileSnapshot: InvestmentProfile;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        name: input.name.trim(),
        initial_amount: input.simulation.input.initialAmount,
        monthly_contribution: input.simulation.input.monthlyContribution,
        horizon_months: input.simulation.input.horizonMonths,
        market_reference_date: input.marketReferenceDate,
        profile_snapshot: input.profileSnapshot as unknown as DbJson,
        allocations: input.simulation.allocations as unknown as DbJson,
        scenarios: input.simulation.scenarios as unknown as DbJson,
        assumptions: input.simulation.assumptions as unknown as DbJson,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("investment_plans").update(payload).eq("id", input.id)
        : await supabase.from("investment_plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investment-plans"] }),
  });
}
