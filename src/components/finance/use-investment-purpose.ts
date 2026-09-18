import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGoals, type Position } from "@/lib/finance-data";
import { calculateFgcExposure } from "@/lib/fgc-exposure";
import { daysUntil } from "@/lib/format";

export function useInvestmentPurpose(positions: Position[]) {
  const goals = useGoals();
  const qc = useQueryClient();

  const links = useQuery({
    queryKey: ["investment-goal-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investment_goal_links").select("*");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async ({ positionId, goalId }: { positionId: string; goalId: string }) => {
      if (!goalId) {
        const { error } = await supabase
          .from("investment_goal_links")
          .delete()
          .eq("position_id", positionId);
        if (error) throw error;
        return;
      }
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("investment_goal_links")
        .upsert({ position_id: positionId, goal_id: goalId, user_id: data.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["investment-goal-links"] });
    },
    onError: () => toast.error("Não foi possível salvar o objetivo da posição."),
  });

  const total = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const profit = positions.reduce((sum, position) => sum + position.profit, 0);
  const fgc = calculateFgcExposure(positions);
  const maturities = positions
    .filter(
      (position) =>
        position.maturityDate &&
        daysUntil(position.maturityDate) >= 0 &&
        daysUntil(position.maturityDate) <= 90,
    )
    .sort((a, b) => a.maturityDate!.localeCompare(b.maturityDate!));

  const institutions = new Map<string, number>();
  for (const position of positions)
    institutions.set(
      position.institution || "Instituição não informada",
      (institutions.get(position.institution || "Instituição não informada") ?? 0) +
        position.marketValue,
    );

  return {
    goals,
    links,
    save,
    total,
    profit,
    fgc,
    maturities,
    institutions,
  };
}
