import { snapshotChange, syncFreshness, wealthSummary } from "@/lib/wealth-summary";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Eye, EyeOff, Plus, Shield, Sparkles, Target, Upload, Wallet } from "lucide-react";
import { useState } from "react";

import {
  BalanceLineChart,
  CreditCardSection,
  ExpenseCategoryCard,
  IncomeCategoryCard,
  MinhasContasCard,
  MonthlyBalanceCard,
  MonthlySavingsCard,
  ObjetivosCard,
  PendingAlertsCard,
  PerfilCard,
  SpendingFrequencyCard,
  SummaryCards,
} from "@/components/finance/dashboard";
import { CashflowSection } from "@/components/finance/DashboardCharts";
import { DataState } from "@/components/finance/DataState";
import { FinancialNextStepCard } from "@/components/finance/FinancialNextStepCard";
import { HealthScore } from "@/components/finance/HealthScore";
import { InvestmentPurpose } from "@/components/finance/InvestmentPurpose";
import { BudgetProgress } from "@/components/finance/BudgetProgress";
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
import { formatBRL, formatPercent } from "@/lib/format";
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
  const sessionUser = useSessionUser();
  const { name } = sessionUser;
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState(false);

  useRealtimeAccounts();
  useRealtimeTransactions();

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

  const currentMonth = cashflow.at(-1);
  const previousMonth = cashflow.at(-2);
  const savingsRate =
    currentMonth && currentMonth.receitas > 0
      ? (currentMonth.saldo / currentMonth.receitas) * 100
      : 0;
  const openBills = upcomingBills.filter(
    (bill) => bill.dbStatus === "pending" || bill.dbStatus === "overdue",
  );
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

  const baseDataLoaded = !loadingAccounts && !loadingTransactions;
  const hasData = accounts.length > 0 || transactions.length > 0;
  const showEmptyCta = baseDataLoaded && !hasData && !accountsError && !transactionsError;

  const creditCardTotal = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + a.balance, 0);

  const freshnessLabel =
    freshness.connected === 0
      ? "Dados manuais"
      : freshness.unknown > 0
        ? "Sync parcial"
        : freshness.oldest
          ? `Atualizado ${new Date(freshness.oldest).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : "";

  return (
    <AppShell>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Visão geral
          </h1>
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
        <Card className="bg-card p-8 text-center shadow-none text-muted-foreground">
          <EyeOff className="mx-auto mb-3 size-6" aria-hidden />
          <p>Informações financeiras ocultas.</p>
        </Card>
      ) : (
        <>
          {showEmptyCta && (
            <Card className="mb-8 flex flex-col items-center gap-3 border-primary/30 bg-primary/5 p-6 shadow-none text-center">
              <Sparkles className="size-8 text-primary" aria-hidden />
              <h2 className="text-lg font-semibold">Comece adicionando suas contas</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Assim que houver dados, este painel mostra patrimônio, fluxo de caixa, orçamento e
                insights do agente automaticamente.
              </p>
              <Button asChild className="mt-2">
                <Link to="/wallet/accounts">
                  <Wallet className="size-4" aria-hidden />
                  Adicionar conta
                </Link>
              </Button>
            </Card>
          )}

          <section aria-label="Resumo financeiro" className="mb-6">
            <SummaryCards
              liquidity={liquidity}
              monthlyIncome={monthlyIncome}
              monthlyExpenses={monthlyExpenses}
              creditCardTotal={creditCardTotal}
              isLoading={loadingAccounts || loadingInvestments}
              hidden={hidden}
            />
          </section>

          <section aria-label="Perfil e desempenho" className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PerfilCard user={sessionUser} />
            </div>
            <Card className="bg-card p-4 shadow-none sm:p-5">
              <p className="text-sm text-muted-foreground">Meu Desempenho</p>
              <div className="mt-2 flex items-baseline gap-3">
                <p className="numeric text-2xl font-semibold">
                  {loadingAccounts ? "—" : formatBRL(netWorth)}
                </p>
                {monthlyChange !== null && (
                  <span
                    className={cn(
                      "numeric inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      monthlyChange > 0 && "bg-success/10 text-success",
                      monthlyChange < 0 && "bg-danger/10 text-danger",
                      monthlyChange === 0 && "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatPercent(monthlyChange)} este mês
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {freshnessLabel && <span className="freshness-stamp">{freshnessLabel}</span>}
              </p>
            </Card>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <FinancialNextStepCard
                analysis={nextStep}
                isLoading={loadingNextStep}
                hasError={nextStepError}
                compact={hasData}
              />

              <IncomeCategoryCard
                transactions={transactions}
                isLoading={loadingTransactions}
                hidden={hidden}
              />

              <ExpenseCategoryCard
                transactions={transactions}
                isLoading={loadingTransactions}
                hidden={hidden}
              />

              <SpendingFrequencyCard
                transactions={transactions}
                isLoading={loadingTransactions}
                hidden={hidden}
              />

              <MonthlyBalanceCard
                transactions={transactions}
                isLoading={loadingTransactions}
                hidden={hidden}
              />

              <PendingAlertsCard
                payables={upcomingBills}
                transactions={transactions}
                budgets={budgetItems}
                isLoading={loadingBills || loadingTransactions || loadingBudget}
                hidden={hidden}
              />

              <ObjetivosCard goals={goals} isLoading={loadingGoals} hidden={hidden} />

              <section aria-label="Insights do agente">
                <Card className="border-primary/50 bg-primary/[0.04] p-5 shadow-none sm:p-6">
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

              <CashflowSection
                cashflowTruncated={cashflowTruncated}
                cashflow={cashflow}
                loadingTransactions={loadingTransactions}
                transactionsError={transactionsError}
                transactions={transactions}
                suppressEmpty={showEmptyCta}
              />

              <Card className="bg-card p-5 shadow-none">
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

              <Card className="bg-card p-5 shadow-none">
                <h2 className="text-base font-semibold">
                  Investimentos: objetivos, riscos e próximos vencimentos
                </h2>
                <div className="mt-4">
                  <DataState loading={loadingInvestments} error={investmentsError}>
                    <InvestmentPurpose positions={positions} />
                  </DataState>
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-6">
              <BalanceLineChart
                data={cashflow}
                isLoading={loadingTransactions}
                hidden={hidden}
              />

              <MinhasContasCard
                accounts={accounts}
                isLoading={loadingAccounts}
                hidden={hidden}
              />

              <CreditCardSection
                accounts={accounts}
                isLoading={loadingAccounts}
                hidden={hidden}
              />

              <MonthlySavingsCard
                savingsRate={savingsRate}
                isLoading={loadingTransactions}
                hidden={hidden}
              />

              <DataState loading={loadingNextStep} error={nextStepError}>
                <HealthScore
                  score={healthScore}
                  breakdown={healthBreakdown}
                  confidence={healthConfidence}
                />
              </DataState>

              <Card className="bg-card p-5 shadow-none">
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
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
