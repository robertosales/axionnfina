import { AlertTriangle, CalendarClock, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import type { BudgetItem } from "@/shared/finance-types";
import type { Payable } from "@/lib/finance/bills";
import type { Transaction } from "@/shared/finance-types";

type PendingAlertsCardProps = {
  payables: Payable[];
  transactions: Transaction[];
  budgets: BudgetItem[];
  isLoading?: boolean;
  hidden?: boolean;
};

type AlertItem = {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
};

function buildAlerts(
  payables: Payable[],
  transactions: Transaction[],
  budgets: BudgetItem[],
): AlertItem[] {
  const alerts: AlertItem[] = [];

  const pendingExpenses = payables.filter(
    (p) => p.dbStatus === "pending" && new Date(`${p.dueDate}T23:59:59`) >= new Date(),
  );
  const pendingExpensesTotal = pendingExpenses.reduce((sum, p) => sum + p.amount, 0);
  if (pendingExpensesTotal > 0) {
    alerts.push({
      icon: CalendarClock,
      label: "Despesas pendentes",
      value: formatBRL(pendingExpensesTotal),
      color: "text-warning",
    });
  }

  const pendingIncomes = transactions.filter(
    (tx) => tx.kind === "income" && tx.pending && !tx.archivedAt,
  );
  const pendingIncomesTotal = pendingIncomes.reduce((sum, tx) => sum + tx.amount, 0);
  if (pendingIncomesTotal > 0) {
    alerts.push({
      icon: TrendingUp,
      label: "Receitas pendentes",
      value: formatBRL(pendingIncomesTotal),
      color: "text-primary",
    });
  }

  const overdueBills = payables.filter(
    (p) => p.dbStatus === "pending" && new Date(`${p.dueDate}T23:59:59`) < new Date(),
  );
  if (overdueBills.length > 0) {
    alerts.push({
      icon: AlertTriangle,
      label: `${overdueBills.length} conta(s) vencida(s)`,
      value: formatBRL(overdueBills.reduce((sum, p) => sum + p.amount, 0)),
      color: "text-danger",
    });
  }

  const overBudget = budgets.filter((b) => b.spent > b.planned && b.planned > 0);
  if (overBudget.length > 0) {
    alerts.push({
      icon: AlertTriangle,
      label: `${overBudget.length} orçamento(s) estourado(s)`,
      value: overBudget.map((b) => b.category).join(", "),
      color: "text-danger",
    });
  }

  return alerts;
}

export function PendingAlertsCard({
  payables,
  transactions,
  budgets,
  isLoading,
  hidden,
}: PendingAlertsCardProps) {
  const alerts = buildAlerts(payables, transactions, budgets);

  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Pendências e alertas</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma pendência encontrada. Tudo em ordem!
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Pendências e alertas</h3>
      <div className="mt-4 space-y-3">
        {alerts.map((alert, index) => {
          const Icon = alert.icon;
          return (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Icon className={`size-5 shrink-0 ${alert.color}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{alert.label}</p>
              </div>
              <span className="numeric text-sm font-medium">{alert.value}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
