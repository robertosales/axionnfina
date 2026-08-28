import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, Shield, Sparkles, TrendingUp, Wallet } from "lucide-react";
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

import { AppShell } from "@/components/layout/AppShell";
import { AccountCard } from "@/components/finance/AccountCard";
import { BudgetProgress } from "@/components/finance/BudgetProgress";
import { ChartCard } from "@/components/finance/ChartCard";
import { KPICard } from "@/components/finance/KPICard";
import { HealthScore, calculateHealthScore } from "@/components/finance/HealthScore";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/hooks/use-session-user";
import { useRealtimeAccounts, useRealtimeTransactions } from "@/hooks/use-realtime";
import { useAnomalyDetection, useMoneyAge } from "@/hooks/use-anomaly-detection";
import {
  useAccounts,
  useBudgets,
  useCashflow,
  useInsights,
  useInvestments,
  useNetWorthSeries,
  usePayables,
  useSeedDemoData,
  useTransactions,
} from "@/lib/finance-data";
import { daysUntil, formatBRL, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Axionn Finance — Painel financeiro com agente de IA" },
      {
        name: "description",
        content:
          "Patrimônio, fluxo de caixa, orçamento e metas em um só painel, com insights automáticos do agente financeiro Axionn.",
      },
      { property: "og:title", content: "Axionn Finance — Painel financeiro com agente de IA" },
      {
        property: "og:description",
        content:
          "Acompanhe patrimônio, liquidez, taxa de poupança e contas a pagar com apoio de um agente financeiro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const severityTone = {
  info: "border-primary/40 bg-primary/5",
  success: "border-success/40 bg-success/5",
  warning: "border-warning/40 bg-warning/5",
  danger: "border-danger/40 bg-danger/5",
} as const;

function Dashboard() {
  const { name } = useSessionUser();

  // Realtime subscriptions
  useRealtimeAccounts();
  useRealtimeTransactions();

  // Anomaly detection
  const { anomalies } = useAnomalyDetection();
  const { daysSinceLastIncome } = useMoneyAge();

  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: agentInsights = [] } = useInsights();
  const { items: budgetItems } = useBudgets();
  const { data: cashflow } = useCashflow();
  const { data: netWorthSeries = [] } = useNetWorthSeries();
  const { allocation, total: totalInvestments } = useInvestments();
  const { data: upcomingBills = [] } = usePayables();
  const { data: transactions = [] } = useTransactions(1000);
  const seed = useSeedDemoData();

  const netWorth = accounts.reduce((total, account) => total + account.balance, 0);
  const liquidity = accounts
    .filter((account) => account.type === "CHECKING" || account.type === "SAVINGS")
    .reduce((total, account) => total + account.balance, 0);
  const totalDebts = accounts
    .filter((account) => account.type === "CREDIT_CARD")
    .reduce((total, account) => total + Math.abs(account.balance), 0);
  const empty = !loadingAccounts && accounts.length === 0;

  const currentMonth = cashflow.at(-1);
  const previousMonth = cashflow.at(-2);
  const savingsRate =
    currentMonth && currentMonth.receitas > 0
      ? (currentMonth.saldo / currentMonth.receitas) * 100
      : 0;
  const previousSavingsRate =
    previousMonth && previousMonth.receitas > 0
      ? (previousMonth.saldo / previousMonth.receitas) * 100
      : 0;
  const netWorthChange =
    netWorthSeries.length > 1 && netWorthSeries[netWorthSeries.length - 2]!.value > 0
      ? ((netWorth - netWorthSeries[netWorthSeries.length - 2]!.value) /
          netWorthSeries[netWorthSeries.length - 2]!.value) *
        100
      : 0;
  const openBills = upcomingBills.filter((bill) => bill.dbStatus !== "paid");
  const nextBill = openBills[0];

  // Health score calculation
  const uniqueCategories = new Set(
    transactions.filter((t) => t.kind === "expense").map((t) => t.category),
  ).size;
  const currentMonthTransactions = transactions.filter((t) => {
    const now = new Date();
    return t.date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }).length;

  const { score: healthScore, breakdown: healthBreakdown } = calculateHealthScore({
    savingsRate,
    totalAssets: netWorth,
    totalDebts,
    monthlyTransactions: currentMonthTransactions,
    uniqueCategories,
  });

  return (
    <AppShell>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Visão geral</h1>
        </div>
        {empty && (
          <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? "Criando…" : "Popular com dados de exemplo"}
          </Button>
        )}
      </header>

      {/* KPIs */}
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Patrimônio líquido"
          value={formatBRL(netWorth)}
          change={Math.round(netWorthChange * 10) / 10}
          icon={TrendingUp}
          sparkline={netWorthSeries.map((p) => ({ value: p.value }))}
        />
        <KPICard
          label="Liquidez imediata"
          value={formatBRL(liquidity)}
          change={Math.round((currentMonth?.saldo ?? 0) > 0 ? 100 * (currentMonth!.saldo / Math.max(currentMonth!.receitas, 1)) : 0) / 10}
          icon={Wallet}
          sparkline={cashflow.map((p) => ({ value: p.saldo }))}
        />
        <KPICard
          label="Taxa de poupança"
          value={`${savingsRate.toFixed(1).replace(".", ",")}%`}
          change={Math.round((savingsRate - previousSavingsRate) * 10) / 10}
          icon={ArrowUpRight}
          tone="success"
        />
        <KPICard
          label="Próximo vencimento"
          value={formatBRL(nextBill?.amount ?? 0)}
          hint={
            nextBill ? `${nextBill.name} · ${formatShortDate(nextBill.dueDate)}` : "Sem contas abertas"
          }
          icon={CalendarClock}
          tone="danger"
        />
      </section>

      {/* Health Score + Anomaly Detection */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <HealthScore
          score={healthScore}
          breakdown={healthBreakdown}
          sparkline={netWorthSeries.map((p) => ({ value: p.value }))}
        />

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Deteção de anomalias</h2>
          </div>
          <div className="mt-4 space-y-3">
            {anomalies.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma anomalia detectada nos últimos meses.
              </p>
            ) : (
              anomalies.slice(0, 3).map((anomaly) => (
                <article
                  key={anomaly.category}
                  className={cn(
                    "rounded-lg border p-3",
                    anomaly.severity === "danger"
                      ? "border-danger/40 bg-danger/5"
                      : "border-warning/40 bg-warning/5",
                  )}
                >
                  <h3 className="text-sm font-medium">{anomaly.category}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {anomaly.message}
                  </p>
                </article>
              ))
            )}
          </div>
        </Card>

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Insights do agente</h2>
          </div>
          <div className="mt-4 space-y-3">
            {agentInsights.slice(0, 3).map((insight) => (
              <article
                key={insight.id}
                className={cn("rounded-lg border p-3", severityTone[insight.severity])}
              >
                <h3 className="text-sm font-medium">{insight.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
              </article>
            ))}
            {daysSinceLastIncome !== null && daysSinceLastIncome > 45 && (
              <article className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                <h3 className="text-sm font-medium">Última receita há {daysSinceLastIncome} dias</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Considere verificar se há receitas pendentes ou se o fluxo de renda está consistente.
                </p>
              </article>
            )}
          </div>
        </Card>
      </section>

      {/* Charts */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Fluxo de caixa"
          description="Receitas x despesas nos últimos 6 meses"
          className="lg:col-span-2"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflow} margin={{ left: -18, right: 8, top: 8 }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
        </ChartCard>

        <ChartCard title="Alocação de investimentos" description="Carteira consolidada">
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
        </ChartCard>
      </section>

      {/* Budget + Accounts + Bills */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Orçamento vs. realizado"
          description="Categorias do mês corrente"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={budgetItems} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} fontSize={11} />
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
                <Area type="monotone" isAnimationActive={false} dataKey="planned" name="Planejado" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.2} />
                <Area type="monotone" isAnimationActive={false} dataKey="spent" name="Realizado" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <h2 className="text-base font-semibold">Contas conectadas</h2>
          <div className="mt-4 grid gap-3">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold">Próximas contas</h2>
          <Card className="rounded-xl border-border/60 p-0 shadow-elevation-1">
            <ul className="divide-y divide-border/60">
              {openBills.slice(0, 4).map((bill) => {
                const days = daysUntil(bill.dueDate);
                return (
                  <li key={bill.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatShortDate(bill.dueDate)} ·{" "}
                        {days < 0 ? `${Math.abs(days)} d em atraso` : `em ${days} d`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="numeric text-sm font-semibold">{formatBRL(bill.amount)}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-1 rounded-full text-[10px]",
                          bill.status === "OVERDUE" && "border-danger/50 text-danger",
                          bill.status === "SCHEDULED" && "border-success/50 text-success",
                        )}
                      >
                        {bill.status === "OVERDUE"
                          ? "Atrasada"
                          : bill.status === "SCHEDULED"
                            ? "Agendada"
                            : "Pendente"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <h3 className="text-sm font-semibold">Saúde do orçamento</h3>
          <div className="mt-4 space-y-4">
            {budgetItems.slice(0, 4).map((item) => (
              <BudgetProgress key={item.id} item={item} />
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
