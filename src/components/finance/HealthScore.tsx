/**
 * HealthScore — KPI card que mostra a saúde financeira do usuário (0-100).
 * Calculado com base em: fluxo de caixa, reserva, dívidas e contas vencidas.
 */
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HealthScoreProps = {
  score: number;
  breakdown?: {
    cashflow: number;
    reserve: number;
    debt: number;
    commitments: number;
  };
  confidence?: "Alta" | "Média" | "Baixa";
  sparkline?: Array<{ value: number }>;
};

const scoreConfig = {
  excellent: { label: "Excelente", color: "text-success", bg: "bg-success/10" },
  good: { label: "Boa", color: "text-income", bg: "bg-income/10" },
  fair: { label: "Regular", color: "text-warning", bg: "bg-warning/10" },
  poor: { label: "Atenção", color: "text-danger", bg: "bg-danger/10" },
} as const;

function getScoreLevel(score: number) {
  if (score >= 80) return scoreConfig.excellent;
  if (score >= 60) return scoreConfig.good;
  if (score >= 40) return scoreConfig.fair;
  return scoreConfig.poor;
}

export function HealthScore({ score, breakdown, confidence, sparkline }: HealthScoreProps) {
  const level = getScoreLevel(score);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference * (1 - score / 100);

  return (
    <Card className="surface-elevated relative gap-0 overflow-hidden rounded-2xl border-border/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">Saúde financeira</span>
        <span className={cn("rounded-full bg-muted/60 p-2", level.color)}>
          <Activity className="size-4" aria-hidden />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative">
          <svg viewBox="0 0 100 100" className="size-20 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <span className="numeric absolute inset-0 flex items-center justify-center text-lg font-semibold">
            {score}
          </span>
        </div>

        <div className="flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className={cn("text-sm font-semibold", level.color)}>{level.label}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Indicador educativo baseado em fluxo de caixa, reserva disponível, dívidas e contas
                vencidas. Não é nota de crédito.
              </p>
            </TooltipContent>
          </Tooltip>

          {breakdown && (
            <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Fluxo mensal</span>
                <span className="numeric">{breakdown.cashflow}/30</span>
              </div>
              <div className="flex justify-between">
                <span>Reserva</span>
                <span className="numeric">{breakdown.reserve}/30</span>
              </div>
              <div className="flex justify-between">
                <span>Dívidas</span>
                <span className="numeric">{breakdown.debt}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Compromissos</span>
                <span className="numeric">{breakdown.commitments}/15</span>
              </div>
              {confidence && <p className="pt-1">Confiança dos dados: {confidence}</p>}
            </div>
          )}
        </div>
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 h-8 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <defs>
                <linearGradient id="spark-health" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#spark-health)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
