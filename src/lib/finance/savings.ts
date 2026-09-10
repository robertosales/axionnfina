import { supabase } from "@/integrations/supabase/client";
import type {
  SavingsOpportunity,
  SavingsPlan,
  SavingsPlanStatus,
} from "@/lib/savings-opportunities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DbJson, requireUserId } from "./common";

export function useSavingsPlans(includeDismissed = false) {
  return useQuery({
    queryKey: ["savings-plans", includeDismissed],
    queryFn: async (): Promise<SavingsPlan[]> => {
      let planRequest = supabase.from("savings_plans").select("*").order("updated_at", {
        ascending: false,
      });
      if (!includeDismissed) planRequest = planRequest.neq("status", "dismissed");

      const [plansResult, checkInsResult] = await Promise.all([
        planRequest,
        supabase.from("saving_plan_checkins").select("*").order("reference_month", {
          ascending: false,
        }),
      ]);
      if (plansResult.error) throw plansResult.error;
      if (checkInsResult.error) throw checkInsResult.error;

      return (plansResult.data ?? []).map((plan) => ({
        id: plan.id,
        key: plan.opportunity_key,
        kind: plan.kind as SavingsOpportunity["kind"],
        title: plan.title,
        description: plan.description,
        category: plan.category,
        merchant: plan.merchant,
        baselineMonthly: Number(plan.baseline_monthly),
        observedAmount: Number(plan.observed_amount),
        targetMonthly: Number(plan.target_monthly),
        expectedMonthlySaving: Number(plan.expected_monthly_saving),
        confidence: plan.confidence,
        evidence: Array.isArray(plan.evidence)
          ? plan.evidence.filter((item): item is string => typeof item === "string")
          : [],
        status: plan.status as SavingsPlanStatus,
        detectedOn: plan.detected_on,
        acceptedAt: plan.accepted_at,
        trackingStartedAt: plan.tracking_started_at,
        completedAt: plan.completed_at,
        dismissedAt: plan.dismissed_at,
        checkIns: (checkInsResult.data ?? [])
          .filter((checkIn) => checkIn.plan_id === plan.id)
          .map((checkIn) => ({
            id: checkIn.id,
            referenceMonth: checkIn.reference_month,
            baselineAmount: Number(checkIn.baseline_amount),
            actualAmount: Number(checkIn.actual_amount),
            realizedSaving: Number(checkIn.realized_saving),
            note: checkIn.note,
          })),
      }));
    },
  });
}

export function useSyncSavingsOpportunities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opportunities: SavingsOpportunity[]) => {
      if (opportunities.length === 0) return 0;
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("savings_plans")
        .upsert(
          opportunities.map((opportunity) => ({
            user_id: userId,
            opportunity_key: opportunity.key,
            kind: opportunity.kind,
            title: opportunity.title,
            description: opportunity.description,
            category: opportunity.category,
            merchant: opportunity.merchant,
            baseline_monthly: opportunity.baselineMonthly,
            observed_amount: opportunity.observedAmount,
            target_monthly: Math.max(
              0,
              opportunity.baselineMonthly - opportunity.expectedMonthlySaving,
            ),
            expected_monthly_saving: opportunity.expectedMonthlySaving,
            confidence: opportunity.confidence,
            evidence: opportunity.evidence as unknown as DbJson,
            status: "detected",
          })),
          { onConflict: "user_id,opportunity_key", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savings-plans"] }),
  });
}

export function useUpdateSavingsPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: SavingsPlanStatus;
      expectedMonthlySaving?: number;
      baselineMonthly?: number;
    }) => {
      const now = new Date().toISOString();
      const timestamp = {
        accepted: { accepted_at: now },
        tracking: { tracking_started_at: now },
        completed: { completed_at: now },
        dismissed: { dismissed_at: now },
        detected: {},
      }[input.status];
      const expected = input.expectedMonthlySaving;
      const { error } = await supabase
        .from("savings_plans")
        .update({
          status: input.status,
          ...timestamp,
          ...(expected !== undefined
            ? {
                expected_monthly_saving: expected,
                target_monthly: Math.max(0, (input.baselineMonthly ?? 0) - expected),
              }
            : {}),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savings-plans"] }),
  });
}

export function useSavingPlanCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      planId: string;
      referenceMonth: string;
      baselineAmount: number;
      actualAmount: number;
      note?: string;
    }) => {
      const userId = await requireUserId();
      const { error } = await supabase.from("saving_plan_checkins").upsert(
        {
          user_id: userId,
          plan_id: input.planId,
          reference_month: `${input.referenceMonth.slice(0, 7)}-01`,
          baseline_amount: input.baselineAmount,
          actual_amount: input.actualAmount,
          realized_saving: Math.max(0, input.baselineAmount - input.actualAmount),
          note: input.note?.trim() || null,
        },
        { onConflict: "plan_id,reference_month" },
      );
      if (error) throw error;

      const { error: planError } = await supabase
        .from("savings_plans")
        .update({ status: "tracking", tracking_started_at: new Date().toISOString() })
        .eq("id", input.planId);
      if (planError) throw planError;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savings-plans"] }),
  });
}
