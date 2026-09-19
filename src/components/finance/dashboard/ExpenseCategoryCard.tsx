import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import type { Transaction } from "@/shared/finance-types";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type ExpenseCategoryCardProps = {
  transactions: Transaction[];
  isLoading?: boolean;
  hidden?: boolean;
};

type CategoryData = {
  category: string;
  value: number;
  percent: number;
};

function groupByCategory(transactions: Transaction[]): CategoryData[] {
  const expenses = transactions.filter(
    (tx) => tx.kind === "expense" && !tx.pending && !tx.archivedAt && tx.amount < 0,
  );

  const total = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  if (total === 0) return [];

  const grouped = new Map<string, number>();
  for (const tx of expenses) {
    const cat = tx.category || "Sem categoria";
    grouped.set(cat, (grouped.get(cat) ?? 0) + Math.abs(tx.amount));
  }

  return [...grouped.entries()]
    .map(([category, value]) => ({
      category,
      value,
      percent: (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export function ExpenseCategoryCard({
  transactions,
  isLoading,
  hidden,
}: ExpenseCategoryCardProps) {
  const data = groupByCategory(transactions);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 flex items-center gap-4">
          <Skeleton className="size-32 rounded-full" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Despesas por categoria</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma despesa registrada neste período.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Despesas por categoria</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div className="size-32 shrink-0" role="img" aria-label="Gráfico de despesas por categoria">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={55}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {data.map((_, index) => (
                  <rect key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatBRL(value)}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((item, index) => (
            <div key={item.category} className="flex items-center gap-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm">{item.category}</span>
              <span className="numeric text-sm font-medium">
                {hidden ? "•••" : formatBRL(item.value)}
              </span>
              <span className="numeric text-xs text-muted-foreground">
                {item.percent.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-right text-xs text-muted-foreground">
        Total: {hidden ? "•••" : formatBRL(total)}
      </p>
    </Card>
  );
}
