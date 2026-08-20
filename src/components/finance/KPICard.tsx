import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
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
    <Card className="surface-elevated relative gap-0 overflow-hidden rounded-xl border-border/60 p-5 transition-[transform,box-shadow] duration-150 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-elevation-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("rounded-lg bg-muted/60 p-2", toneRing[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <p className="numeric mt-3 cursor-default text-2xl font-semibold tracking-tight">
            {value}
          </p>
        </TooltipTrigger>
        <TooltipContent>{hint ?? label}</TooltipContent>
      </Tooltip>

      <div className="mt-2 flex items-end justify-between gap-4">
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
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
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
