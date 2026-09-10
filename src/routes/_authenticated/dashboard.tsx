import { DashboardCharts } from "@/components/finance/DashboardCharts";
import { DataState } from "@/components/finance/DataState";
import { InvestmentPurpose } from "@/components/finance/InvestmentPurpose";
import { snapshotChange, syncFreshness, wealthSummary } from "@/lib/wealth-summary";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bot,
  CalendarClock,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip, XAxis } from "recharts";

import { AccountCard } from "@/components/finance/AccountCard";
import { BudgetProgress } from "@/components/finance/BudgetProgress";
import { ChartCard } from "@/components/finance/ChartCard";
import { FinancialNextStepCard } from "@/components/finance/FinancialNextStepCard";
import { HealthScore } from "@/components/finance/HealthScore";
import { KPICard } from "@/components/finance/KPICard";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAnomalyDetection, useMoneyAge } from "@/hooks/use-anomaly-detection";
import { useRealtimeAccounts, useRealtimeTransactions } from "@/hooks/use-realtime";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  useAccounts,
  useBudgets,
  useCashflow,
  useGoals,
  useInsights,
  useInvestments,
  useNetWorthSeries,
  usePayables,
  useTransactions,
} from "@/lib/finance-data";
import { calculateHealthScore } from "@/lib/financial-health";
import { analyzeFinancialReadiness } from "@/lib/financial-next-step";
import { daysUntil, formatBRL, formatPercent, formatShortDate } from "@/lib/format";
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
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [historyMonths, setHistoryMonths] = useState(6);

  // Realtime subscriptions
  useRealtimeAccounts();
  useRealtimeTransactions();

  // Anomaly detection
  const { anomalies } = useAnomalyDetection();
  const { daysSinceLastIncome } = useMoneyAge();

  const { data: accounts = [], isLoading: loadingAccounts, isError: accountsError } = useAccounts();
  const {
    data: agentInsights = [],
    isLoading: loadingInsights,
    isError: insightsError,
  } = useInsights();
  const { items: budgetItems, isLoading: loadingBudget, isError: budgetError } = useBudgets();
  const { data: cashflow, isTruncated: cashflowTruncated } = useCashflow();
  const {
    data: netWorthSeries = [],
    isLoading: loadingHistory,
    isError: historyError,
  } = useNetWorthSeries();
  const {
    allocation,
    positions,
    total: totalInvestments,
    isLoading: loadingInvestments,
    isError: investmentsError,
  } = useInvestments();
  const { data: upcomingBills = [], isLoading: loadingBills, isError: billsError } = usePayables();
  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    isError: transactionsError,
  } = useTransactions(null);
  const { data: goals = [], isLoading: loadingGoals, isError: goalsError } = useGoals();
  const {
    netWorth,
    liquidity,
    debts: totalDebts,
    usesInvestmentAccounts,
  } = wealthSummary(accounts, totalInvestments);
  const freshness = syncFreshness(accounts);
  const monthlyChange = snapshotChange(netWorthSeries, 1);
  const annualChange = snapshotChange(netWorthSeries, 12);

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
  const openBills = upcomingBills.filter(
    (bill) => bill.dbStatus === "pending" || bill.dbStatus === "overdue",
  );
  const nextBill = openBills[0];
  const nextStep = analyzeFinancialReadiness({
    accounts,
    transactions: transactions.filter((transaction) => !transaction.pending),
    bills: openBills,
    goals,
    investmentTotal: totalInvestments,
  });
  const loadingNextStep =
    loadingAccounts || loadingTransactions || loadingBills || loadingGoals || loadingInvestments;
  const nextStepError =
    accountsError || transactionsError || billsError || goalsError || investmentsError;

  const monthsObserved = new Set(transactions.map((transaction) => transaction.date.slice(0, 7)))
    .size;
  const overdueBills = openBills.filter(
    (bill) => new Date(`${bill.dueDate}T23:59:59`) < new Date(),
  ).length;
  const monthlyIncome = currentMonth?.receitas ?? 0;
  const monthlyExpenses = currentMonth?.despesas ?? 0;

  const {
    score: healthScore,
    breakdown: healthBreakdown,
    confidence: healthConfidence,
  } = calculateHealthScore({
    monthlyIncome,
    monthlyExpenses,
    liquidAssets: Math.max(0, liquidity),
    totalDebts,
    overdueBills,
    monthsObserved,
    transactionCount: transactions.length,
  });

  return (
    <AppShell>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Visão geral</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={hidden}
          onClick={() => setHidden((value) => !value)}
        >
          {hidden ? (
            <Eye className="size-4" aria-hidden />
          ) : (
            <EyeOff className="size-4" aria-hidden />
          )}
          {hidden ? "Mostrar valores" : "Ocultar valores"}
        </Button>
      </header>

      <nav
        aria-label="Ações rápidas"
        className="mb-6 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap"
      >
        <Button asChild>
          <Link to="/transactions" search={{ new: true }}>
            <Plus className="size-4" aria-hidden />
            Nova transação
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/wallet/imports">
            <Upload className="size-4" aria-hidden />
            Importar documento
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/wallet/connect">
            <Landmark className="size-4" aria-hidden />
            Conectar banco
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/goals" search={{ new: true }}>
            <Target className="size-4" aria-hidden />
            Criar meta
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/agent">
            <Bot className="size-4" aria-hidden />
            Perguntar ao agente
          </Link>
        </Button>
      </nav>

      {hidden ? (
        <Card className="p-8 text-center text-muted-foreground">
          <EyeOff className="mx-auto mb-3 size-6" aria-hidden />
          <p>Informações financeiras ocultas.</p>
        </Card>
      ) : (
        <>
          <section
            aria-label="Resumo patrimonial"
            className="mb-6 grid min-w-0 gap-4 lg:grid-cols-3"
          >
            <Card
              className="min-w-0 rounded-2xl border-primary/20 p-5 sm:p-6 lg:col-span-2"
              style={{ background: "var(--gradient-surface)" }}
            >
              <p className="text-sm font-medium text-muted-foreground">Patrimônio líquido</p>
              <DataState
                loading={loadingAccounts || loadingInvestments}
                error={accountsError || investmentsError}
                onRetry={() => {
                  void queryClient.invalidateQueries({ queryKey: ["accounts"] });
                  void queryClient.invalidateQueries({ queryKey: ["investments"] });
                }}
              >
                <p className="numeric mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                  {formatBRL(netWorth)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {usesInvestmentAccounts
                    ? "Saldos das contas, incluindo contas de investimento."
                    : "Saldos das contas e posições de investimento."}
                </p>
              </DataState>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p>
                  Snapshots: mês {monthlyChange === null ? "—" : formatPercent(monthlyChange)} · ano{" "}
                  {annualChange === null ? "—" : formatPercent(annualChange)}
                </p>
                <div className="flex gap-1" aria-label="Período do histórico">
                  {[6, 12].map((months) => (
                    <Button
                      key={months}
                      variant={historyMonths === months ? "secondary" : "ghost"}
                      size="sm"
                      aria-pressed={historyMonths === months}
                      onClick={() => setHistoryMonths(months)}
                    >
                      {months} meses
                    </Button>
                  ))}
                </div>
              </div>
              <DataState
                loading={loadingHistory}
                error={historyError}
                empty={netWorthSeries.length === 0}
              >
                <div
                  className="mt-4 h-44"
                  role="img"
                  aria-label="Evolução do patrimônio; valores disponíveis na tabela abaixo"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={netWorthSeries.slice(-historyMonths)} accessibilityLayer>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                      <RTooltip formatter={(value: number) => formatBRL(value)} />
                      <Area
                        dataKey="value"
                        name="Patrimônio"
                        stroke="var(--color-primary)"
                        fill="var(--color-primary)"
                        fillOpacity={0.12}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <details className="mt-2 text-sm">
                  <summary className="focus-ring cursor-pointer rounded text-muted-foreground">
                    Consultar histórico em tabela
                  </summary>
                  <table className="mt-2 w-full">
                    <caption className="sr-only">Snapshots patrimoniais</caption>
                    <thead>
                      <tr>
                        <th className="text-left">Mês</th>
                        <th className="text-right">Patrimônio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {netWorthSeries.slice(-historyMonths).map((point) => (
                        <tr key={point.date}>
                          <td>{point.date.slice(0, 7)}</td>
                          <td className="numeric text-right">{formatBRL(point.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </DataState>
              <p className="mt-4 text-sm text-muted-foreground">
                {freshness.connected === 0
                  ? "Dados manuais ou importados. Atualização sob sua responsabilidade."
                  : freshness.unknown > 0
                    ? "Há contas sem data de sincronização informada."
                    : `Sincronização mais antiga: ${freshness.oldest ? new Date(freshness.oldest).toLocaleString("pt-BR") : "não informada"}.`}
                {freshness.stale && " Dados possivelmente desatualizados."}{" "}
                <Link to="/wallet/connect" className="focus-ring rounded text-primary underline">
                  Ver conexões
                </Link>
              </p>
            </Card>
            <div className="min-w-0 space-y-4">
              <DataState loading={loadingNextStep} error={nextStepError}>
                <HealthScore
                  score={healthScore}
                  breakdown={healthBreakdown}
                  confidence={healthConfidence}
                />
              </DataState>
              <Card className="p-5">
                <h2 className="font-semibold">Sua próxima conquista</h2>
                <DataState loading={loadingGoals} error={goalsError} empty={goals.length === 0}>
                  {[...goals]
                    .filter((goal) => goal.target > 0 && goal.current < goal.target)
                    .sort((a, b) => b.current / b.target - a.current / a.target)
                    .slice(0, 1)
                    .map((goal) => (
                      <div key={goal.id}>
                        <p className="mt-3 text-sm">{goal.name}</p>
                        <p className="numeric mt-1 text-lg font-semibold">
                          {formatBRL(Math.max(0, goal.target - goal.current))} para chegar lá
                        </p>
                      </div>
                    ))}
                </DataState>
                <Link
                  to="/goals"
                  className="focus-ring mt-3 inline-block rounded text-sm text-primary underline"
                >
                  Acompanhar metas
                </Link>
              </Card>
            </div>
          </section>

          <FinancialNextStepCard
            analysis={nextStep}
            isLoading={loadingNextStep}
            hasError={nextStepError}
          />

          {/* KPIs */}
          <section
            aria-label="Indicadores"
            className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <KPICard
              label="Dívidas nas contas"
              value={
                accountsError
                  ? "Indisponível"
                  : loadingAccounts
                    ? "Carregando…"
                    : formatBRL(totalDebts)
              }
              icon={TrendingUp}
            />
            <KPICard
              label="Liquidez imediata"
              value={
                accountsError
                  ? "Indisponível"
                  : loadingAccounts
                    ? "Carregando…"
                    : formatBRL(liquidity)
              }
              icon={Wallet}
              sparkline={cashflow.map((p) => ({ value: p.saldo }))}
            />
            <KPICard
              label="Taxa de poupança"
              value={
                transactionsError
                  ? "Indisponível"
                  : loadingTransactions
                    ? "Carregando…"
                    : monthlyIncome > 0
                      ? formatPercent(savingsRate)
                      : "Sem receitas"
              }
              hint={
                previousMonth && previousMonth.receitas > 0
                  ? `${formatPercent(savingsRate - previousSavingsRate).replace("%", "")} p.p. em relação ao mês anterior`
                  : "Sem receitas anteriores para comparar"
              }
              icon={ArrowUpRight}
              tone="success"
            />
            <KPICard
              label="Próximo vencimento"
              value={
                billsError
                  ? "Indisponível"
                  : loadingBills
                    ? "Carregando…"
                    : formatBRL(nextBill?.amount ?? 0)
              }
              hint={
                nextBill
                  ? `${nextBill.name} · ${formatShortDate(nextBill.dueDate)}`
                  : "Sem contas abertas"
              }
              icon={CalendarClock}
              tone="danger"
            />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <h2 className="text-base font-semibold">Próximas contas</h2>
              <Card className="rounded-xl border-border/60 p-0 shadow-elevation-1">
                <DataState loading={loadingBills} error={billsError}>
                  {!loadingBills && !billsError && openBills.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">Nenhuma conta em aberto.</p>
                  )}
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
                            <p className="numeric text-sm font-semibold">
                              {formatBRL(bill.amount)}
                            </p>
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
                  <Link
                    to="/bills"
                    className="focus-ring m-4 inline-block rounded text-sm text-primary underline"
                  >
                    Ver todas as contas
                  </Link>
                </DataState>
              </Card>
            </div>

            <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
              <h3 className="text-sm font-semibold">Saúde do orçamento</h3>
              <DataState
                loading={loadingBudget}
                error={budgetError}
                empty={budgetItems.length === 0}
              >
                <div className="mt-4 space-y-4">
                  {budgetItems.slice(0, 4).map((item) => (
                    <BudgetProgress key={item.id} item={item} />
                  ))}
                </div>
              </DataState>
            </Card>
          </section>

          {/* Health Score + Anomaly Detection */}
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold">Detecção de anomalias</h2>
              </div>
              <div className="mt-4 space-y-3">
                <DataState loading={loadingTransactions} error={transactionsError}>
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
                </DataState>
              </div>
            </Card>

            <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold">Insights do agente</h2>
              </div>
              <div className="mt-4 space-y-3">
                <DataState
                  loading={loadingInsights}
                  error={insightsError}
                  empty={agentInsights.length === 0}
                >
                  {agentInsights.slice(0, 3).map((insight) => (
                    <article
                      key={insight.id}
                      className={cn("rounded-lg border p-3", severityTone[insight.severity])}
                    >
                      <h3 className="text-sm font-medium">{insight.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {insight.body}
                      </p>
                    </article>
                  ))}
                </DataState>
                {daysSinceLastIncome !== null && daysSinceLastIncome > 45 && (
                  <article className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                    <h3 className="text-sm font-medium">
                      Última receita há {daysSinceLastIncome} dias
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Considere verificar se há receitas pendentes ou se o fluxo de renda está
                      consistente.
                    </p>
                  </article>
                )}
              </div>
            </Card>
          </section>

          <DashboardCharts
            cashflowTruncated={cashflowTruncated}
            cashflow={cashflow}
            loadingTransactions={loadingTransactions}
            transactionsError={transactionsError}
            transactions={transactions}
            loadingInvestments={loadingInvestments}
            investmentsError={investmentsError}
            allocation={allocation}
          />

          <details className="mt-6 rounded-xl border border-border bg-card p-5">
            <summary className="focus-ring cursor-pointer rounded font-semibold">
              Investimentos: objetivos, riscos e próximos vencimentos
            </summary>
            <div className="mt-4">
              <DataState loading={loadingInvestments} error={investmentsError}>
                <InvestmentPurpose positions={positions} />
              </DataState>
            </div>
          </details>

          {/* Budget + Accounts + Bills */}
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <ChartCard
              title="Transações recentes"
              description="Últimas movimentações registradas"
              className="lg:col-span-2"
            >
              <DataState
                loading={loadingTransactions}
                error={transactionsError}
                empty={transactions.length === 0}
              >
                <ul className="divide-y divide-border">
                  {transactions.slice(0, 5).map((transaction) => (
                    <li key={transaction.id} className="flex flex-wrap justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatShortDate(transaction.date)} ·{" "}
                          {transaction.kind === "income"
                            ? "Receita"
                            : transaction.kind === "expense"
                              ? "Despesa"
                              : "Transferência"}{" "}
                          · {transaction.category}
                        </p>
                      </div>
                      <p className="numeric text-sm font-semibold">
                        {formatBRL(transaction.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/transactions"
                  className="focus-ring mt-3 inline-block rounded text-sm text-primary underline"
                >
                  Ver transações
                </Link>
              </DataState>
            </ChartCard>

            <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
              <h2 className="text-base font-semibold">Contas e origem dos dados</h2>
              <DataState
                loading={loadingAccounts}
                error={accountsError}
                empty={accounts.length === 0}
              >
                <div className="mt-4 grid gap-3">
                  {accounts.map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              </DataState>
            </Card>
          </section>
        </>
      )}
    </AppShell>
  );
}
