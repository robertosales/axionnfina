import { useEffect, useMemo, useRef, useState } from "react";
import {
  useSavingPlanCheckIn,
  useSavingsPlans,
  useSyncSavingsOpportunities,
  useTransactions,
  useUpdateSavingsPlan,
} from "@/lib/finance-data";
import { detectSavingsOpportunities, type SavingsPlan, type SavingsPlanStatus } from "@/lib/savings-opportunities";
import { parseFinancialInput } from "@/lib/financial-input";
import { toast } from "sonner";

const previousMonth = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function useSavingsPlanPanel() {
  const { data: transactions = [], isLoading: loadingTransactions } = useTransactions(1000);
  const { data: plans = [], isLoading: loadingPlans, isError, refetch } = useSavingsPlans();
  const sync = useSyncSavingsOpportunities();
  const update = useUpdateSavingsPlan();
  const checkIn = useSavingPlanCheckIn();
  const [checkInPlan, setCheckInPlan] = useState<SavingsPlan | null>(null);
  const [actualAmount, setActualAmount] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(previousMonth);
  const syncedSignature = useRef("");

  const opportunities = useMemo(() => detectSavingsOpportunities({ transactions }), [transactions]);
  const signature = opportunities
    .map((item) => item.key)
    .sort()
    .join("|");

  useEffect(() => {
    if (
      loadingTransactions ||
      loadingPlans ||
      isError ||
      !signature ||
      syncedSignature.current === signature
    ) {
      return;
    }
    syncedSignature.current = signature;
    sync.mutate(opportunities);
  }, [isError, loadingPlans, loadingTransactions, opportunities, signature, sync]);

  const detected = useMemo(() => plans.filter((plan) => plan.status === "detected"), [plans]);
  const active = useMemo(
    () => plans.filter((plan) => plan.status === "accepted" || plan.status === "tracking"),
    [plans],
  );
  const completed = useMemo(() => plans.filter((plan) => plan.status === "completed"), [plans]);
  const plannedSaving = useMemo(
    () => active.reduce((sum, plan) => sum + plan.expectedMonthlySaving, 0),
    [active],
  );
  const realizedSaving = useMemo(
    () =>
      plans.reduce(
        (sum, plan) =>
          sum + plan.checkIns.reduce((subtotal, item) => subtotal + item.realizedSaving, 0),
        0,
      ),
    [plans],
  );
  const loading = loadingTransactions || loadingPlans;

  const mutateStatus = (plan: SavingsPlan, status: SavingsPlanStatus) => {
    update.mutate(
      { id: plan.id, status },
      {
        onSuccess: () =>
          toast.success(
            status === "accepted"
              ? "Oportunidade adicionada ao seu plano"
              : status === "completed"
                ? "Plano concluído"
                : "Oportunidade dispensada",
          ),
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  const saveCheckIn = () => {
    if (!checkInPlan) return;
    const amount = parseFinancialInput(actualAmount);
    if (!Number.isFinite(amount) || amount < 0 || !referenceMonth) {
      toast.error("Informe o mês e quanto foi gasto");
      return;
    }
    checkIn.mutate(
      {
        planId: checkInPlan.id,
        referenceMonth,
        baselineAmount: checkInPlan.baselineMonthly,
        actualAmount: amount,
      },
      {
        onSuccess: () => {
          toast.success("Resultado mensal registrado");
          setCheckInPlan(null);
          setActualAmount("");
        },
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return {
    plans,
    loading,
    isError,
    refetch,
    sync,
    opportunities,
    detected,
    active,
    completed,
    plannedSaving,
    realizedSaving,
    checkInPlan,
    setCheckInPlan,
    actualAmount,
    setActualAmount,
    referenceMonth,
    setReferenceMonth,
    mutateStatus,
    saveCheckIn,
  };
}
