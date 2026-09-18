import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useEntityLifecycle,
  useInvestmentPlans,
  useInvestmentRadar,
  useUpsertInvestmentPlan,
} from "@/lib/finance-data";
import { simulateInvestmentPlan, type SavedInvestmentPlan } from "@/lib/investment-plan";

function numberFromInput(value: string): number {
  const compact = value.replace(/\s/g, "");
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useInvestmentPlanSimulator() {
  const radar = useInvestmentRadar();
  const [showArchived, setShowArchived] = useState(false);
  const plans = useInvestmentPlans(showArchived);
  const upsert = useUpsertInvestmentPlan();
  const lifecycle = useEntityLifecycle("investment_plan");
  const [tab, setTab] = useState("simulate");
  const [initialAmount, setInitialAmount] = useState("1000");
  const [monthlyContribution, setMonthlyContribution] = useState("500");
  const [horizonMonths, setHorizonMonths] = useState(24);
  const [saveOpen, setSaveOpen] = useState(false);
  const [planName, setPlanName] = useState("Meu plano de aporte");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (radar.data?.profile.horizonMonths) setHorizonMonths(radar.data.profile.horizonMonths);
  }, [radar.data?.profile.horizonMonths]);

  const simulation = useMemo(
    () =>
      radar.data
        ? simulateInvestmentPlan(radar.data, {
            initialAmount: numberFromInput(initialAmount),
            monthlyContribution: numberFromInput(monthlyContribution),
            horizonMonths,
          })
        : null,
    [horizonMonths, initialAmount, monthlyContribution, radar.data],
  );

  const loadPlan = (plan: SavedInvestmentPlan) => {
    setInitialAmount(String(plan.input.initialAmount));
    setMonthlyContribution(String(plan.input.monthlyContribution));
    setHorizonMonths(plan.input.horizonMonths);
    setPlanName(plan.name);
    setEditingId(plan.id);
    setTab("simulate");
    toast.success("Plano carregado no simulador.");
  };

  const openNewSave = () => {
    setEditingId(null);
    setPlanName(
      `Plano de ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
    );
    setSaveOpen(true);
  };

  const savePlan = () => {
    if (!radar.data || !simulation || simulation.allocations.length === 0) {
      toast.error("O Radar precisa de oportunidades válidas antes de salvar.");
      return;
    }
    if (!planName.trim()) {
      toast.error("Informe um nome para o plano.");
      return;
    }
    if (simulation.input.initialAmount + simulation.input.monthlyContribution <= 0) {
      toast.error("Informe um aporte inicial ou mensal maior que zero.");
      return;
    }
    upsert.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        name: planName,
        simulation,
        marketReferenceDate: radar.data.referenceDate,
        profileSnapshot: radar.data.profile,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Plano atualizado." : "Plano salvo.");
          setSaveOpen(false);
          setTab("plans");
        },
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return {
    radar,
    showArchived,
    setShowArchived,
    plans,
    upsert,
    lifecycle,
    tab,
    setTab,
    initialAmount,
    setInitialAmount,
    monthlyContribution,
    setMonthlyContribution,
    horizonMonths,
    setHorizonMonths,
    saveOpen,
    setSaveOpen,
    planName,
    setPlanName,
    editingId,
    simulation,
    loadPlan,
    openNewSave,
    savePlan,
  };
}
