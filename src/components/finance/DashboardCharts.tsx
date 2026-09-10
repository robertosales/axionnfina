import { DataState } from "@/components/finance/DataState";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/finance/ChartCard";
import { useCashflow, useInvestments, useTransactions } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";

type DashboardChartsProps = {
  cashflowTruncated: boolean;
  cashflow: ReturnType<typeof useCashflow>["data"];
  loadingTransactions: boolean;
  transactionsError: boolean;
  transactions: NonNullable<ReturnType<typeof useTransactions>["data"]>;
  loadingInvestments: boolean;
  investmentsError: boolean;
  allocation: ReturnType<typeof useInvestments>["allocation"];
};

export function DashboardCharts({
  cashflowTruncated,
  cashflow,
  loadingTransactions,
  transactionsError,
  transactions,
  loadingInvestments,
  investmentsError,
  allocation,
}: DashboardChartsProps) {
  return (
    <>
      {/* Charts */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Fluxo de caixa"
          description={
            cashflowTruncated
              ? "Amostra das últimas 1.000 transações; resultado parcial"
              : "Receitas e despesas nos últimos 6 meses, sem transferências"
          }
          className="lg:col-span-2"
        >
          <DataState
            loading={loadingTransactions}
            error={transactionsError}
            empty={transactions.length === 0}
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  accessibilityLayer
                  data={cashflow}
                  margin={{ left: -18, right: 8, top: 8 }}
                >
                  <defs>
                    <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-out" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-expense)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickFormatter={(v: number) => formatBRL(v, true)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={70}
                  />
                  <RTooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    isAnimationActive={false}
                    dataKey="receitas"
                    stroke="var(--color-income)"
                    strokeWidth={2}
                    fill="url(#grad-in)"
                  />
                  <Area
                    type="monotone"
                    isAnimationActive={false}
                    dataKey="despesas"
                    stroke="var(--color-expense)"
                    strokeWidth={2}
                    fill="url(#grad-out)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-2 text-sm">
              <summary className="focus-ring cursor-pointer rounded">
                Ver valores do fluxo de caixa
              </summary>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="text-right">Receitas</th>
                    <th className="text-right">Despesas</th>
                  </tr>
                </thead>
                <tbody>
                  {cashflow.map((month) => (
                    <tr key={month.month}>
                      <td>{month.month}</td>
                      <td className="numeric text-right">{formatBRL(month.receitas)}</td>
                      <td className="numeric text-right">{formatBRL(month.despesas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </DataState>
        </ChartCard>

        <ChartCard title="Alocação de investimentos" description="Carteira consolidada">
          <DataState
            loading={loadingInvestments}
            error={investmentsError}
            empty={allocation.length === 0}
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    isAnimationActive={false}
                    stroke="none"
                  >
                    {allocation.map((slice) => (
                      <Cell key={slice.name} fill={slice.token} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              {allocation.map((item) => (
                <li key={item.name} className="flex flex-wrap justify-between gap-2">
                  <span>{item.name}</span>
                  <span className="numeric">{formatBRL(item.value)}</span>
                </li>
              ))}
            </ul>
          </DataState>
        </ChartCard>
      </section>
    </>
  );
}
