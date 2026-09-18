import { formatPercent, formatBRL, formatShortDate } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { DataState } from "./DataState";
import { useInvestmentPurpose } from "./use-investment-purpose";
import type { Position } from "@/lib/finance-data";

export function InvestmentPurpose({ positions }: { positions: Position[] }) {
  const { goals, links, save, total, profit, fgc, maturities, institutions } =
    useInvestmentPurpose(positions);

  return (
    <Card className="min-w-0 bg-card p-5 shadow-none">
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
                {total > 0 ? formatPercent((value / total) * 100).replace(/^\+/, "") : "—"}
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
