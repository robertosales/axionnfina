import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetItem } from "@/shared/finance-types";

/** Barra de orçamento com marcadores de threshold (80% alerta, 100% estouro). */
export function BudgetProgress({ item }: { item: BudgetItem }) {
  const ratio = item.planned > 0 ? item.spent / item.planned : 0;
  const pct = Math.min(ratio, 1.35) * 100;
  const state = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "success";

  const fill = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[state];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{item.category}</span>
        <span className="numeric text-xs text-muted-foreground">
          <span className={cn(state === "danger" && "text-danger")}>{formatBRL(item.spent)}</span>
          {" / "}
          {formatBRL(item.planned)}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out", fill)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        <span className="absolute inset-y-0 left-[80%] w-px bg-border" aria-hidden />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="numeric">{Math.round(ratio * 100)}% utilizado</span>
        {item.rollover ? (
          <span className="numeric">rollover +{formatBRL(item.rollover)}</span>
        ) : (
          <span className="numeric">
            {ratio >= 1 ? "estourado " : "resta "}
            {formatBRL(Math.abs(item.planned - item.spent))}
          </span>
        )}
      </div>
    </div>
  );
}
