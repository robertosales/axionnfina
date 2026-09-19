import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/format";

type MonthlySavingsCardProps = {
  savingsRate: number;
  isLoading?: boolean;
  hidden?: boolean;
};

function getMotivationalMessage(rate: number): string {
  if (rate >= 30) return "Excelente! Você está no caminho certo.";
  if (rate >= 20) return "Muito bom! Continue assim.";
  if (rate >= 10) return "Bom início. Tente economizar mais.";
  if (rate > 0) return "Quase lá! Aumente sua economia.";
  if (rate === 0) return "Sem economia este mês.";
  return "Gastos acima das receitas. Atenção!";
}

export function MonthlySavingsCard({
  savingsRate,
  isLoading,
  hidden,
}: MonthlySavingsCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 flex justify-center">
          <Skeleton className="size-32 rounded-full" />
        </div>
      </Card>
    );
  }

  const clampedRate = Math.min(Math.max(savingsRate, -100), 100);
  const displayRate = hidden ? 0 : clampedRate;
  const circumference = 2 * Math.PI * 45;
  const progress = (Math.max(displayRate, 0) / 100) * circumference;
  const color =
    displayRate >= 20
      ? "var(--color-success)"
      : displayRate >= 10
        ? "var(--color-warning)"
        : displayRate > 0
          ? "var(--color-primary)"
          : "var(--color-danger)";

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Economia mensal</h3>
      <div className="mt-4 flex flex-col items-center">
        <div
          className="relative size-32"
          role="img"
          aria-label={`Percentual de economia: ${hidden ? "oculto" : formatPercent(displayRate)}`}
        >
          <svg className="size-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="numeric text-2xl font-bold">
              {hidden ? "•••" : `${Math.round(displayRate)}%`}
            </span>
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {hidden ? "Valores ocultos" : getMotivationalMessage(displayRate)}
        </p>
      </div>
    </Card>
  );
}
