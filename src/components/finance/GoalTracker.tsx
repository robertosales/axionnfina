import { Card } from "@/components/ui/card";
import { daysUntil, formatBRL, formatLongDate } from "@/lib/format";
import type { Goal } from "@/shared/finance-types";
import type { ReactNode } from "react";

/**
 * Anel de progresso SVG + projeção simplificada (P10/P50/P90).
 * A projeção real virá do RPC `get_cashflow_projection` em fase posterior.
 */
export function GoalTracker({ goal, actions }: { goal: Goal; actions?: ReactNode }) {
  const ratio = Math.min(goal.current / goal.target, 1);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const days = daysUntil(goal.dueDate);
  const monthsLeft = Math.max(Math.round(days / 30), 1);
  const requiredMonthly = (goal.target - goal.current) / monthsLeft;

  return (
    <Card className="relative flex flex-row items-center gap-5 rounded-xl border-border/60 p-5 pr-12 shadow-elevation-1">
      {actions && <div className="absolute right-3 top-3">{actions}</div>}
      <svg viewBox="0 0 100 100" className="size-24 shrink-0 -rotate-90" role="img">
        <title>{`${Math.round(ratio * 100)}% concluído`}</title>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{goal.name}</p>
        <p className="numeric mt-1 text-lg font-semibold">
          {formatBRL(goal.current)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            de {formatBRL(goal.target)}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Meta em {formatLongDate(goal.dueDate)} · {monthsLeft} meses
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-muted/60 px-2 py-1.5">
            <p className="text-muted-foreground">Sugerido/mês</p>
            <p className="numeric font-medium">{formatBRL(goal.monthlySuggestion)}</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-2 py-1.5">
            <p className="text-muted-foreground">Necessário/mês</p>
            <p className="numeric font-medium">{formatBRL(requiredMonthly)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
