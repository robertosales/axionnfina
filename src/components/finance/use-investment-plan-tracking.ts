import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_INVESTMENT_ALERT_PREFERENCES,
  useInvestmentAlertPreferences,
  useInvestmentPlans,
  useInvestmentProgressHistory,
  useInvestments,
  useRunInvestmentMonitoring,
  useUpdateInvestmentAlertPreferences,
  type InvestmentAlertPreferences,
} from "@/lib/finance-data";
import { calculateInvestmentPlanProgress } from "@/lib/investment-progress";

export function useInvestmentPlanTracking() {
  const plans = useInvestmentPlans(false);
  const investments = useInvestments(false);
  const preferences = useInvestmentAlertPreferences();
  const updatePreferences = useUpdateInvestmentAlertPreferences();
  const runMonitoring = useRunInvestmentMonitoring();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<InvestmentAlertPreferences>(
    DEFAULT_INVESTMENT_ALERT_PREFERENCES,
  );

  useEffect(() => {
    if (!selectedPlanId && plans.data?.[0]) setSelectedPlanId(plans.data[0].id);
  }, [plans.data, selectedPlanId]);

  useEffect(() => {
    if (preferences.data) setDraft(preferences.data);
  }, [preferences.data]);

  const selectedPlan = plans.data?.find((plan) => plan.id === selectedPlanId);
  const progress = useMemo(() => {
    if (!selectedPlan) return null;
    return calculateInvestmentPlanProgress(
      selectedPlan,
      investments.positions.map((position) => ({
        id: position.id,
        ticker: position.ticker,
        name: position.name,
        marketValue: position.marketValue,
      })),
    );
  }, [investments.positions, selectedPlan]);
  const history = useInvestmentProgressHistory(selectedPlanId || undefined);

  const savePreferences = () => {
    if (
      draft.minimumScore < 0 ||
      draft.minimumScore > 100 ||
      draft.scoreChangeThreshold < 1 ||
      draft.scoreChangeThreshold > 50 ||
      draft.driftThreshold < 1 ||
      draft.driftThreshold > 100 ||
      draft.maturityAlertDays < 1 ||
      draft.maturityAlertDays > 365
    ) {
      toast.error("Revise os limites: nota 0–100, variação 1–50 e desvio 1–100.");
      return;
    }
    updatePreferences.mutate(
      {
        enabled: draft.enabled,
        inAppEnabled: draft.inAppEnabled,
        minimumScore: draft.minimumScore,
        scoreChangeThreshold: draft.scoreChangeThreshold,
        driftThreshold: draft.driftThreshold,
        privateComparisonAmount: draft.privateComparisonAmount,
        privateOfferMaxAgeDays: draft.privateOfferMaxAgeDays,
        maturityAlertDays: draft.maturityAlertDays,
      },
      {
        onSuccess: () => {
          toast.success("Alertas de investimento atualizados");
          setSettingsOpen(false);
        },
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  const updateNow = () => {
    runMonitoring.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          `Análise atualizada: ${result?.plansEvaluated ?? 0} plano(s) e ${result?.insightsCreated ?? 0} novo(s) insight(s).`,
        ),
      onError: () =>
        toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
    });
  };

  return {
    plans,
    investments,
    preferences,
    updatePreferences,
    runMonitoring,
    selectedPlanId,
    setSelectedPlanId,
    settingsOpen,
    setSettingsOpen,
    draft,
    setDraft,
    selectedPlan,
    progress,
    history,
    savePreferences,
    updateNow,
  };
}
