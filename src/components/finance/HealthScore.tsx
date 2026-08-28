/**
 * HealthScore — KPI card que mostra a saúde financeira do usuário (0-100).
 * Calculado com base em: taxa de poupança, diversificação, endividamento, regularidade.
 */
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HealthScoreProps = {
  score: number;
  breakdown?: {
    savingsRate: number;
    diversification: number;
    debtRatio: number;
    regularity: number;
  };
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

export function HealthScore({ score, breakdown, sparkline }: HealthScoreProps) {
  const level = getScoreLevel(score);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference * (1 - score / 100);

  return (
    <Card className="surface-elevated relative gap-0 overflow-hidden rounded-xl border-border/60 p-5 transition-[transform,box-shadow] duration-150 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-elevation-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">Saúde financeira</span>
        <span className={cn("rounded-lg bg-muted/60 p-2", level.color)}>
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
              <p className="text-xs">Score calculado com base em poupança, diversificação, dívidas e regularidade.</p>
            </TooltipContent>
          </Tooltip>

          {breakdown && (
            <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Poupança</span>
                <span className="numeric">{breakdown.savingsRate}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Diversificação</span>
                <span className="numeric">{breakdown.diversification}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Endividamento</span>
                <span className="numeric">{breakdown.debtRatio}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Regularidade</span>
                <span className="numeric">{breakdown.regularity}/25</span>
              </div>
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

/* ------------------------------------------------------------------ */
/* Health Score Calculator                                             */
/* ------------------------------------------------------------------ */

type HealthScoreInput = {
  savingsRate: number; // 0-100%
  totalAssets: number;
  totalDebts: number;
  monthlyTransactions: number;
  uniqueCategories: number;
};

/**
 * Calcula o score de saúde financeira (0-100).
 *
 * Critérios (25 pontos cada):
 * 1. Poupança: 0% = 0pts, ≥30% = 25pts
 * 2. Diversificação: 1 categoria = 0pts, ≥5 = 25pts
 * 3. Endividamento: 100%+ = 0pts, 0% = 25pts
 * 4. Regularidade: 0 transações = 0pts, ≥20/mês = 25pts
 */
export function calculateHealthScore(input: HealthScoreInput) {
  const savings = Math.max(0, Math.min(25, Math.round((input.savingsRate / 30) * 25)));
  const diversification = Math.max(
    0,
    Math.min(25, Math.round(((input.uniqueCategories - 1) / 4) * 25)),
  );
  const debtRatio = input.totalAssets > 0 ? input.totalDebts / input.totalAssets : null;
  const debt = debtRatio === null ? 0 : Math.max(0, Math.min(25, Math.round((1 - debtRatio) * 25)));
  const regularity = Math.max(
    0,
    Math.min(25, Math.round((input.monthlyTransactions / 20) * 25)),
  );

  const total = savings + diversification + debt + regularity;

  return {
    score: total,
    breakdown: {
      savingsRate: savings,
      diversification,
      debtRatio: debt,
      regularity,
    },
  };
}
