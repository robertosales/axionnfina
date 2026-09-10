import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGoals, type Position } from "@/lib/finance-data";
import { formatBRL, formatShortDate, daysUntil } from "@/lib/format";
import { calculateFgcExposure } from "@/lib/fgc-exposure";
import { Card } from "@/components/ui/card";
import { DataState } from "./DataState";

export function InvestmentPurpose({ positions }: { positions: Position[] }) {
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
  return (
    <Card className="min-w-0 p-5">
      <h2 className="text-lg font-semibold">Investimentos e seus objetivos</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Situação atual</h3>
          <p className="numeric mt-2 text-xl font-semibold">{formatBRL(total)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultado bruto não realizado: {formatBRL(profit)}. O resultado líquido depende de
            impostos, taxas e datas de aquisição.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Riscos e liquidez</h3>
          <p className="mt-2 text-sm">
            {fgc.groups.filter((group) => group.status !== "safe").length} conglomerado(s) exigem
            atenção na faixa FGC.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {positions.filter((position) => position.fgcEligible === null).length} posição(ões) sem
            elegibilidade FGC informada.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {maturities.length} posição(ões) vencem em até 90 dias. Vencimento não garante liquidez
            antecipada.
          </p>
        </div>
      </div>
      <details className="mt-4">
        <summary className="focus-ring cursor-pointer rounded py-2 text-sm font-medium">
          Concentração por instituição e vencimentos
        </summary>
        <ul className="mt-2 space-y-2 text-sm">
          {[...institutions].map(([institution, value]) => (
            <li key={institution} className="flex flex-wrap justify-between gap-2">
              <span>{institution}</span>
              <span className="numeric">
                {total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "—"}
              </span>
            </li>
          ))}
          {maturities.map((position) => (
            <li key={position.id}>
              {position.name} · {formatShortDate(position.maturityDate!)}
            </li>
          ))}
        </ul>
      </details>
      <h3 className="mt-4 text-sm font-medium">Próxima ação: dê um objetivo a cada posição</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        O vínculo identifica a finalidade do investimento; não altera o valor já reservado na meta.
      </p>
      <DataState
        loading={goals.isLoading || links.isLoading}
        error={goals.isError || links.isError}
        empty={positions.length === 0}
      >
        <div className="mt-4 space-y-3">
          {positions.map((position) => (
            <div key={position.id} className="grid min-w-0 items-center gap-2 sm:grid-cols-2">
              <label htmlFor={`purpose-${position.id}`} className="break-words text-sm">
                {position.name}
              </label>
              <select
                id={`purpose-${position.id}`}
                className="focus-ring h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 text-sm"
                disabled={save.isPending}
                value={links.data?.find((link) => link.position_id === position.id)?.goal_id ?? ""}
                onChange={(event) =>
                  save.mutate({ positionId: position.id, goalId: event.target.value })
                }
              >
                <option value="">Sem objetivo vinculado</option>
                {goals.data?.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </DataState>
      <p className="mt-4 text-sm">
        <Link to="/investments" className="focus-ring rounded text-primary underline">
          Explorar oportunidades educacionais no Radar
        </Link>
      </p>
    </Card>
  );
}
