import { AllocationSection, CashflowSection } from "@/components/finance/DashboardCharts";
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

  // No real data yet: show a single call-to-action instead of repeating
  // empty messages inside each card.
  const baseDataLoaded = !loadingAccounts && !loadingTransactions;
  const hasData = accounts.length > 0 || transactions.length > 0;
  const showEmptyCta = baseDataLoaded && !hasData && !accountsError && !transactionsError;

  // Semantic tones for the KPI strip
  const debtsTone = totalDebts > 0 ? "danger" : "success";
  const liquidityTone = liquidity > 0 ? "success" : liquidity < 0 ? "danger" : "default";
  const savingsTone =
    monthlyIncome <= 0 ? "default" : savingsRate > 0 ? "success" : savingsRate < 0 ? "danger" : "default";
  const nextBillDays = nextBill ? daysUntil(nextBill.dueDate) : null;
  const billTone =
    nextBill === undefined || nextBillDays === null
      ? "default"
      : nextBillDays < 0
        ? "danger"
        : nextBillDays <= 7
          ? "warning"
          : "default";

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
          {/* Chamada única de estado vazio */}
          {showEmptyCta && (
            <Card className="mb-8 flex flex-col items-center gap-3 rounded-2xl border-primary/30 bg-primary/5 p-8 text-center">
              <Sparkles className="size-8 text-primary" aria-hidden />
              <h2 className="text-lg font-semibold">Comece conectando suas contas</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Assim que houver dados, este painel mostra patrimônio, fluxo de caixa, orçamento e
                insights do agente automaticamente.
              </p>
              <Button asChild className="mt-2">
                <Link to="/wallet/connect">
                  <Landmark className="size-4" aria-hidden />
                  Conectar contas
                </Link>
              </Button>
            </Card>
          )}

          {/* Zona 1 — KPIs */}
          <section
            aria-label="Indicadores"
            className="mb-8 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
          >
            <KPICard
              label="Quanto você deve"
              description="Soma dos saldos negativos e cartões de crédito. Zero é o ideal."
              value={
                accountsError
                  ? "Indisponível"
                  : loadingAccounts
                    ? "Carregando…"
                    : formatBRL(totalDebts)
              }
              icon={TrendingUp}
              tone={loadingAccounts || accountsError ? "default" : debtsTone}
            />
            <KPICard
              label="Dinheiro disponível"
              description="Dinheiro em conta corrente/poupança que você pode usar hoje, sem contar investimentos."
              value={
                accountsError
                  ? "Indisponível"
                  : loadingAccounts
                    ? "Carregando…"
                    : formatBRL(liquidity)
              }
              icon={Wallet}
              sparkline={cashflow.map((p) => ({ value: p.saldo }))}
              tone={loadingAccounts || accountsError ? "default" : liquidityTone}
            />
            <KPICard
              label="Sobra do mês"
              description="Percentual da renda que sobrou depois das despesas deste mês. Quanto maior, melhor."
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
              tone={loadingTransactions || transactionsError ? "default" : savingsTone}
            />
            <KPICard
              label="Próxima conta a pagar"
              description="Valor e data da conta em aberto mais próxima do vencimento."
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
              tone={loadingBills || billsError ? "default" : billTone}
            />
          </section>

          {/* Zona 2 — Hero: patrimônio líquido */}
          <section aria-label="Resumo patrimonial" className="mb-8">
            <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/[0.03] p-5 sm:p-6">
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
                suppressEmpty={showEmptyCta}
              >
                <div
                  className="mt-4 h-44"
                  role="img"
                  aria-label="Evolução do patrimônio; valores disponíveis na tabela abaixo"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={netWorthSeries.slice(-historyMonths)} accessibilityLayer>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                      <RTooltip
                        formatter={(value: number) => formatBRL(value)}
                        contentStyle={{
                          background: "var(--popover)",
                          color: "var(--foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: 16,
                        }}
                      />
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
          </section>

          {/* Zona 3 — Insights do agente (IA) */}
          <section aria-label="Insights do agente" className="mb-8">
            <Card className="rounded-2xl border-primary/50 bg-primary/[0.04] p-5 shadow-elevation-1 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <h2 className="text-base font-semibold">Insights do agente</h2>
                <Badge variant="outline" className="rounded-full border-primary/40 text-primary">
                  IA
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DataState
                  loading={loadingInsights}
                  error={insightsError}
                  empty={agentInsights.length === 0}
                  suppressEmpty={showEmptyCta}
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

          {/* Zona 4 — Seu próximo passo */}
          <div className="mb-8">
            <FinancialNextStepCard
              analysis={nextStep}
              isLoading={loadingNextStep}
              hasError={nextStepError}
              compact={hasData}
            />
          </div>

          {/* Zona 5 — Duas colunas */}
          <section aria-label="Detalhes" className="mb-8 grid min-w-0 gap-6 lg:grid-cols-3">
            {/* Coluna principal */}
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <CashflowSection
                cashflowTruncated={cashflowTruncated}
                cashflow={cashflow}
                loadingTransactions={loadingTransactions}
                transactionsError={transactionsError}
                transactions={transactions}
                suppressEmpty={showEmptyCta}
              />

              <div>
                <h2 className="mb-3 text-base font-semibold">Próximas contas</h2>
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
                  suppressEmpty={showEmptyCta}
                >
                  <div className="mt-4 space-y-4">
                    {budgetItems.slice(0, 4).map((item) => (
                      <BudgetProgress key={item.id} item={item} />
                    ))}
                  </div>
                </DataState>
              </Card>

              <ChartCard
                title="Transações recentes"
                description="Últimas movimentações registradas"
              >
                <DataState
                  loading={loadingTransactions}
                  error={transactionsError}
                  empty={transactions.length === 0}
                  suppressEmpty={showEmptyCta}
                >
                  <ul className="divide-y divide-border">
                    {transactions.slice(0, 5).map((transaction) => (
                      <li
                        key={transaction.id}
                        className="flex flex-wrap justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">
                            {transaction.description}
                          </p>
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
            </div>

            {/* Coluna lateral */}
            <div className="min-w-0 space-y-6">
              <DataState loading={loadingNextStep} error={nextStepError}>
                <HealthScore
                  score={healthScore}
                  breakdown={healthBreakdown}
                  confidence={healthConfidence}
                />
              </DataState>

              <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
                <h2 className="font-semibold">Sua próxima conquista</h2>
                <DataState
                  loading={loadingGoals}
                  error={goalsError}
                  empty={goals.length === 0}
                  suppressEmpty={showEmptyCta}
                >
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

              <AllocationSection
                loadingInvestments={loadingInvestments}
                investmentsError={investmentsError}
                allocation={allocation}
                suppressEmpty={showEmptyCta}
              />

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
            </div>
          </section>

          {/* Zona 6 — Bastidores (recolhido por padrão) */}
          <details className="rounded-2xl border border-border bg-card p-5">
            <summary className="focus-ring cursor-pointer rounded font-semibold">
              Contas, origem dos dados e detalhes de investimentos
            </summary>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1 lg:col-span-1">
                <h2 className="text-base font-semibold">Contas e origem dos dados</h2>
                <DataState
                  loading={loadingAccounts}
                  error={accountsError}
                  empty={accounts.length === 0}
                  suppressEmpty={showEmptyCta}
                >
                  <div className="mt-4 grid gap-3">
                    {accounts.map((account) => (
                      <AccountCard key={account.id} account={account} />
                    ))}
                  </div>
                </DataState>
              </Card>
              <div className="lg:col-span-2">
                <h2 className="text-base font-semibold">
                  Investimentos: objetivos, riscos e próximos vencimentos
                </h2>
                <div className="mt-4">
                  <DataState loading={loadingInvestments} error={investmentsError}>
                    <InvestmentPurpose positions={positions} />
                  </DataState>
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </AppShell>
  );
}
