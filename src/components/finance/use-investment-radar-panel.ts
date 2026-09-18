import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useInvestmentRadar, useUpdateInvestmentProfile } from "@/lib/finance-data";
import type {
  InvestmentProfile,
  RiskProfile,
  LiquidityPreference,
  InvestmentObjective,
} from "@/lib/investment-radar";

export function useInvestmentRadarPanel() {
  const radar = useInvestmentRadar();
  const updateProfile = useUpdateInvestmentProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [draft, setDraft] = useState<InvestmentProfile>({
    riskProfile: "conservative",
    horizonMonths: 24,
    liquidityPreference: "daily",
    objective: "reserve",
  });

  useEffect(() => {
    if (radar.data?.profile) setDraft(radar.data.profile);
  }, [radar.data?.profile]);

  const saveProfile = () => {
    if (draft.horizonMonths < 1 || draft.horizonMonths > 600) {
      toast.error("Informe um horizonte entre 1 e 600 meses.");
      return;
    }
    updateProfile.mutate(draft, {
      onSuccess: () => {
        toast.success("Preferências atualizadas. O ranking será recalculado.");
        setProfileOpen(false);
      },
      onError: () =>
        toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
    });
  };

  return {
    radar,
    profileOpen,
    setProfileOpen,
    draft,
    setDraft,
    updateProfile,
    saveProfile,
  };
}
