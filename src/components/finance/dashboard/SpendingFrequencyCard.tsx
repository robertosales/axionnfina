import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import type { Transaction } from "@/shared/finance-types";

type SpendingFrequencyCardProps = {
  transactions: Transaction[];
  isLoading?: boolean;
  hidden?: boolean;
};

type DayData = {
  day: string;
  dayNum: number;
  value: number;
};

function getDaysInMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function groupByDay(transactions: Transaction[]): DayData[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = getDaysInMonth();

  const expenses = transactions.filter(
    (tx) =>
      tx.kind === "expense" &&
      !tx.pending &&
      !tx.archivedAt &&
      tx.amount < 0 &&
      tx.date.startsWith(currentMonth),
  );

  const grouped = new Map<number, number>();
  for (const tx of expenses) {
    const day = Number(tx.date.slice(8, 10));
    grouped.set(day, (grouped.get(day) ?? 0) + Math.abs(tx.amount));
  }

  const result: DayData[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    result.push({
      day: String(d),
      dayNum: d,
      value: grouped.get(d) ?? 0,
    });
  }
  return result;
}

export function SpendingFrequencyCard({
  transactions,
  isLoading,
  hidden,
}: SpendingFrequencyCardProps) {
  const data = groupByDay(transactions);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-32 w-full" />
      </Card>
    );
  }

  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Frequência de gastos</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum gasto registrado neste mês.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Frequência de gastos</h3>
      <div
        className="mt-4 h-32"
        role="img"
        aria-label="Frequência de gastos por dia do mês"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="10%">
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              fontSize={10}
              interval={4}
            />
            <YAxis hide />
            <Tooltip
              formatter={(value: number) => formatBRL(value)}
              labelFormatter={(label: string) => `Dia ${label}`}
              contentStyle={{
                background: "var(--popover)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <Bar
              dataKey="value"
              name="Gastos"
              fill="var(--color-primary)"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Maior gasto: {hidden ? "•••" : formatBRL(maxValue)}
      </p>
    </Card>
  );
}
