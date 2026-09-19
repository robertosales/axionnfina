import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";

type BalanceLineChartProps = {
  data: Array<{ month: string; receitas: number; despesas: number; saldo: number }>;
  isLoading?: boolean;
  hidden?: boolean;
};

export function BalanceLineChart({ data, isLoading, hidden }: BalanceLineChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-4 h-48 w-full" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Balanço receitas × despesas</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Dados insuficientes para exibir o gráfico.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Balanço receitas × despesas</h3>
      <div
        className="mt-4 h-48"
        role="img"
        aria-label="Evolução do balanço entre receitas e despesas nos últimos meses"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              fontSize={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              fontSize={12}
              tickFormatter={(value: number) => formatBRL(value, true)}
              width={60}
            />
            <Tooltip
              formatter={(value: number) => formatBRL(value)}
              contentStyle={{
                background: "var(--popover)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <Line
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Receitas: {hidden ? "•••" : formatBRL(data.at(-1)?.receitas ?? 0)}</span>
        <span>Despesas: {hidden ? "•••" : formatBRL(data.at(-1)?.despesas ?? 0)}</span>
      </div>
    </Card>
  );
}
