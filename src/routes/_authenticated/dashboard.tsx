import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, Sparkles, TrendingUp, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  accounts,
  agentInsights,
  allocation,
  budgetItems,
  cashflow,
  kpis,
  netWorthSeries,
  upcomingBills,
} from "@/lib/mock-data";
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
  return (
    <AppShell>
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Olá, Roberto</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Visão geral de agosto
        </h1>
      </header>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Patrimônio líquido"
          value={formatBRL(kpis.netWorth.value)}
          change={kpis.netWorth.change}
          icon={TrendingUp}
          sparkline={netWorthSeries.map((p) => ({ value: p.value }))}
        />
        <KPICard
          label="Liquidez imediata"
          value={formatBRL(kpis.liquidity.value)}
          change={kpis.liquidity.change}
          icon={Wallet}
          sparkline={cashflow.map((p) => ({ value: p.saldo }))}
        />
        <KPICard
          label="Taxa de poupança"
          value={`${kpis.savingsRate.value.toString().replace(".", ",")}%`}
          change={kpis.savingsRate.change}
          icon={ArrowUpRight}
          tone="success"
        />
        <KPICard
          label="Próximo vencimento"
          value={formatBRL(kpis.nextBill.value)}
          hint={`${kpis.nextBill.label} · ${formatShortDate(kpis.nextBill.dueDate)}`}
          icon={CalendarClock}
          tone="danger"
        />
      </section>

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

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Orçamento vs. realizado"
          description="Categorias do mês corrente"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetItems} margin={{ left: -18, right: 8, top: 8 }}>
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
                <Bar isAnimationActive={false} dataKey="planned" name="Planejado" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="spent" name="Realizado" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <h2 className="text-base font-semibold">Insights do agente</h2>
          </div>
          <div className="mt-4 space-y-3">
            {agentInsights.map((insight) => (
              <article
                key={insight.id}
                className={cn("rounded-lg border p-3", severityTone[insight.severity])}
              >
                <h3 className="text-sm font-medium">{insight.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold">Contas conectadas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </div>

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <h2 className="text-base font-semibold">Próximas contas</h2>
          <ul className="mt-4 space-y-3">
            {upcomingBills.map((bill) => {
              const days = daysUntil(bill.dueDate);
              return (
                <li key={bill.id} className="flex items-center justify-between gap-3">
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

          <Separator className="my-5" />

          <h3 className="text-sm font-semibold">Saúde do orçamento</h3>
          <div className="mt-4 space-y-4">
            {budgetItems.slice(0, 3).map((item) => (
              <BudgetProgress key={item.id} item={item} />
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
