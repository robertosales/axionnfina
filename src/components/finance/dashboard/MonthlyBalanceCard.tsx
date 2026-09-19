import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import type { Transaction } from "@/shared/finance-types";

type MonthlyBalanceCardProps = {
  transactions: Transaction[];
  isLoading?: boolean;
  hidden?: boolean;
};

type DayBalance = {
  day: string;
  dayNum: number;
  balance: number;
};

function getDaysInMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function calculateDailyBalance(transactions: Transaction[]): DayBalance[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = getDaysInMonth();

  const monthTx = transactions.filter(
    (tx) =>
      !tx.pending &&
      !tx.archivedAt &&
      tx.kind !== "transfer" &&
      tx.kind !== "investment" &&
      tx.date.startsWith(currentMonth),
  );

  const dailyTotals = new Map<number, number>();
  for (const tx of monthTx) {
    const day = Number(tx.date.slice(8, 10));
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + tx.amount);
  }

  let accumulated = 0;
  const result: DayBalance[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    accumulated += dailyTotals.get(d) ?? 0;
    result.push({
      day: String(d),
      dayNum: d,
      balance: accumulated,
    });
  }
  return result;
}

export function MonthlyBalanceCard({
  transactions,
  isLoading,
  hidden,
}: MonthlyBalanceCardProps) {
  const data = calculateDailyBalance(transactions);
  const finalBalance = data.at(-1)?.balance ?? 0;

  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-48 w-full" />
      </Card>
    );
  }

  const hasData = data.some((d) => d.balance !== 0);

  if (!hasData) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Balanço mensal</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma movimentação registrada neste mês.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Balanço mensal</h3>
        <span
          className={`numeric text-sm font-medium ${
            finalBalance >= 0 ? "text-success" : "text-danger"
          }`}
        >
          {hidden ? "•••" : formatBRL(finalBalance)}
        </span>
      </div>
      <div
        className="mt-4 h-48"
        role="img"
        aria-label="Evolução do saldo acumulado no mês"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              fontSize={10}
              interval={4}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              fontSize={10}
              tickFormatter={(value: number) => formatBRL(value, true)}
              width={60}
            />
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
            <Area
              type="monotone"
              dataKey="balance"
              name="Saldo"
              stroke="var(--color-primary)"
              fill="url(#balanceGradient)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
