import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  change?: number;
  hint?: string;
  sparkline?: Array<{ value: number }>;
  tone?: "default" | "success" | "warning" | "danger";
};

const toneRing: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
};

export function KPICard({
  label,
  value,
  icon: Icon,
  change,
  hint,
  sparkline,
  tone = "default",
}: Props) {
  const positive = (change ?? 0) >= 0;

  return (
    <Card className="surface-elevated relative h-full rounded-2xl border-border/40 p-5">
      <div className="flex items-center gap-4">
        <span
          className={cn("grid size-12 shrink-0 place-items-center rounded-full", toneRing[tone])}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="numeric mt-1 break-words text-xl font-semibold tracking-tight sm:text-2xl">
            {value}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        {change !== undefined ? (
          <span
            className={cn(
              "numeric inline-flex items-center gap-1 text-xs font-medium",
              positive ? "text-success" : "text-danger",
            )}
          >
            {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {formatPercent(change)}
            <span className="text-muted-foreground">vs. mês anterior</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}

        {sparkline && (
          <div className="h-8 w-24 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill={`url(#spark-${label})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

export function KPICardSkeleton() {
  return (
    <Card className="rounded-xl p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-40" />
    </Card>
  );
}
