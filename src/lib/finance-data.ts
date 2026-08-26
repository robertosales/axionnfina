import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Account, AccountType, AgentInsight, BudgetItem, Goal, Transaction } from "@/lib/mock-data";
import {
  accounts as demoAccounts,
  agentInsights as demoInsights,
  budgetItems as demoBudgets,
  goals as demoGoals,
  recentTransactions as demoTransactions,
} from "@/lib/mock-data";

/** Mapa entre o enum do banco e o tipo usado na UI. */
const dbToUiAccountType = {
  checking: "CHECKING",
  savings: "SAVINGS",
  credit: "CREDIT_CARD",
  investment: "INVESTMENT",
} as const;

const uiToDbAccountType = {
  CHECKING: "checking",
  SAVINGS: "savings",
  CREDIT_CARD: "credit",
  INVESTMENT: "investment",
} as const;

type DbAccountType = keyof typeof dbToUiAccountType;
type DbTransactionType = "income" | "expense" | "transfer";
type DbSeverity = "info" | "warning" | "critical";

const severityToUi = {
  info: "info",
  warning: "warning",
  critical: "danger",
} as const;

function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user.id;
}

/** Contas do usuário logado, já no formato usado pelos componentes. */
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, institution, type, balance, open_finance, last_sync_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        institution: row.institution,
        name: row.name,
        type: dbToUiAccountType[row.type as DbAccountType],
        balance: Number(row.balance),
        lastSyncedAt: row.last_sync_at ?? new Date().toISOString(),
        openFinance: row.open_finance,
      }));
    },
  });
}

/** Transações mais recentes do usuário logado. */
export function useTransactions(limit = 200) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, description, merchant, category, type, amount, occurred_at, accounts(name)")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        description: row.description,
        merchant: row.merchant ?? "",
        category: row.category,
        kind: row.type as DbTransactionType,
        amount: Number(row.amount),
        date: row.occurred_at,
        accountName: row.accounts?.name ?? "—",
      }));
    },
  });
}

/** Orçamento do mês corrente, com o gasto calculado a partir das transações. */
export function useBudgets() {
  const transactions = useTransactions();

  const query = useQuery({
    queryKey: ["budgets", monthStart()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, category, planned, month")
        .eq("month", monthStart())
        .order("category", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const month = monthStart().slice(0, 7);
  const items: BudgetItem[] = (query.data ?? []).map((row) => {
    const spent = (transactions.data ?? [])
      .filter((tx) => tx.category === row.category && tx.date.startsWith(month) && tx.amount < 0)
      .reduce((total, tx) => total + Math.abs(tx.amount), 0);
    return { id: row.id, category: row.category, planned: Number(row.planned), spent };
  });

  return { ...query, items };
}

/** Metas financeiras com sugestão mensal derivada do prazo. */
export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, target_amount, current_amount, deadline")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const target = Number(row.target_amount);
        const current = Number(row.current_amount);
        const deadline = row.deadline ?? "";
        const months = deadline
          ? Math.max(
              1,
              Math.round((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)),
            )
          : 12;
        return {
          id: row.id,
          name: row.title,
          target,
          current,
          dueDate: deadline,
          monthlySuggestion: Math.max(0, Math.round((target - current) / months)),
        };
      });
    },
  });
}

/** Insights gerados pelo agente. */
export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: async (): Promise<AgentInsight[]> => {
      const { data, error } = await supabase
        .from("agent_insights")
        .select("id, title, description, severity")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.description,
        severity: severityToUi[row.severity as DbSeverity],
      }));
    },
  });
}

/**
 * Popula a conta do usuário com um conjunto de dados de exemplo.
 * Útil para explorar o app antes de conectar bancos reais.
 */
export function useSeedDemoData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await requireUserId();

      const accountRows = demoAccounts.map((account) => ({
        user_id: userId,
        name: account.name,
        institution: account.institution,
        type: uiToDbAccountType[account.type as AccountType],
        balance: account.balance,
        open_finance: account.openFinance,
        last_sync_at: account.lastSyncedAt,
      }));

      const { data: inserted, error: accountsError } = await supabase
        .from("accounts")
        .insert(accountRows)
        .select("id, name");
      if (accountsError) throw accountsError;

      const accountIdByName = new Map((inserted ?? []).map((row) => [row.name, row.id]));

      const transactionRows = demoTransactions.map((tx) => ({
        user_id: userId,
        account_id: accountIdByName.get(tx.accountName) ?? null,
        description: tx.description,
        merchant: tx.merchant,
        category: tx.category,
        type: ((tx.kind === "income" ? "income" : tx.kind === "transfer" ? "transfer" : "expense") satisfies DbTransactionType) as DbTransactionType,
        amount: tx.amount,
        occurred_at: tx.date,
      }));
      const { error: txError } = await supabase.from("transactions").insert(transactionRows);
      if (txError) throw txError;

      const { error: budgetError } = await supabase.from("budgets").insert(
        demoBudgets.map((item) => ({
          user_id: userId,
          category: item.category,
          planned: item.planned,
          month: monthStart(),
        })),
      );
      if (budgetError) throw budgetError;

      const { error: goalError } = await supabase.from("goals").insert(
        demoGoals.map((goal) => ({
          user_id: userId,
          title: goal.name,
          target_amount: goal.target,
          current_amount: goal.current,
          deadline: goal.dueDate,
        })),
      );
      if (goalError) throw goalError;

      const { error: insightError } = await supabase.from("agent_insights").insert(
        demoInsights.map((insight) => ({
          user_id: userId,
          title: insight.title,
          description: insight.body,
          severity: ((insight.severity === "warning"
            ? "warning"
            : insight.severity === "danger"
              ? "critical"
              : "info") satisfies DbSeverity) as DbSeverity,
        })),
      );
      if (insightError) throw insightError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
