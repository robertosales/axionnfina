import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Account, AccountType, AgentInsight, BudgetItem, Goal, Transaction, UpcomingBill } from "@/lib/mock-data";
import {
  accounts as demoAccounts,
  agentInsights as demoInsights,
  budgetItems as demoBudgets,
  goals as demoGoals,
  recentTransactions as demoTransactions,
  upcomingBills as demoBills,
} from "@/lib/mock-data";
import type { AssetClass, BillStatus } from "@/shared/domain";
import { ASSET_CLASS_COLOR, ASSET_CLASS_LABEL } from "@/shared/domain";

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

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

export function monthStart(date = new Date()): string {
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
        .select("id, name, institution, type, balance, open_finance, last_sync_at, branch, account_number")
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
        branch: row.branch ?? "",
        accountNumber: row.account_number ?? "",
      }));
    },
  });
}

export function useUpsertAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      institution: string;
      name: string;
      type: AccountType;
      balance: number;
      branch?: string;
      accountNumber?: string;
      openFinance?: boolean;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        institution: input.institution,
        name: input.name,
        type: uiToDbAccountType[input.type],
        balance: input.balance,
        open_finance: false,
        last_sync_at: new Date().toISOString(),
        branch: input.branch?.trim() || null,
        account_number: input.accountNumber?.trim() || null,
        open_finance: input.openFinance ?? false,
      };
      const { error } = input.id
        ? await supabase.from("accounts").update(payload).eq("id", input.id)
        : await supabase.from("accounts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounts"] }),
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

/* ------------------------------------------------------------------ */
/* Investimentos                                                       */
/* ------------------------------------------------------------------ */

export type Position = {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profit: number;
};

export function useInvestments() {
  const query = useQuery({
    queryKey: ["investments"],
    queryFn: async (): Promise<Position[]> => {
      const { data, error } = await supabase
        .from("investment_positions")
        .select("id, ticker, name, asset_class, quantity, average_price, current_price")
        .order("ticker", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const quantity = Number(row.quantity);
        const averagePrice = Number(row.average_price);
        const currentPrice = Number(row.current_price);
        return {
          id: row.id,
          ticker: row.ticker,
          name: row.name,
          assetClass: row.asset_class as AssetClass,
          quantity,
          averagePrice,
          currentPrice,
          marketValue: quantity * currentPrice,
          profit: quantity * (currentPrice - averagePrice),
        };
      });
    },
  });

  const positions = query.data ?? [];
  const total = positions.reduce((sum, p) => sum + p.marketValue, 0);

  const byClass = new Map<AssetClass, number>();
  for (const p of positions) byClass.set(p.assetClass, (byClass.get(p.assetClass) ?? 0) + p.marketValue);

  const allocation = [...byClass.entries()].map(([assetClass, value]) => ({
    name: ASSET_CLASS_LABEL[assetClass],
    value,
    token: ASSET_CLASS_COLOR[assetClass],
  }));

  return { ...query, positions, allocation, total };
}

/* ------------------------------------------------------------------ */
/* Contas a pagar / receber                                            */
/* ------------------------------------------------------------------ */

const statusToUi = {
  pending: "PENDING",
  paid: "SCHEDULED",
  overdue: "OVERDUE",
  canceled: "PENDING",
} as const satisfies Record<BillStatus, UpcomingBill["status"]>;

export type Payable = UpcomingBill & { category: string; scheduled: boolean; dbStatus: BillStatus };

export function usePayables() {
  return useQuery({
    queryKey: ["payables"],
    queryFn: async (): Promise<Payable[]> => {
      const { data, error } = await supabase
        .from("payables")
        .select("id, description, amount, due_date, status, category, scheduled_for")
        .order("due_date", { ascending: true });
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      return (data ?? []).map((row) => {
        const status = row.status as BillStatus;
        const overdue = status === "pending" && row.due_date < today;
        return {
          id: row.id,
          name: row.description,
          amount: Number(row.amount),
          dueDate: row.due_date,
          status: overdue ? "OVERDUE" : row.scheduled_for ? "SCHEDULED" : statusToUi[status],
          category: row.category,
          scheduled: Boolean(row.scheduled_for),
          dbStatus: status,
        };
      });
    },
  });
}

export function useReceivables() {
  return useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("id, description, amount, due_date, status, payer")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        description: row.description,
        amount: Number(row.amount),
        dueDate: row.due_date,
        status: row.status as BillStatus,
        payer: row.payer,
      }));
    },
  });
}

/* ------------------------------------------------------------------ */
/* Séries derivadas                                                    */
/* ------------------------------------------------------------------ */

/** Fluxo de caixa dos últimos 6 meses, agregado a partir das transações reais. */
export function useCashflow(months = 6) {
  const transactions = useTransactions(1000);

  const buckets = new Map<string, { month: string; receitas: number; despesas: number; saldo: number }>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { month: MONTH_LABELS[d.getMonth()] ?? key, receitas: 0, despesas: 0, saldo: 0 });
  }

  for (const tx of transactions.data ?? []) {
    const key = tx.date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.amount >= 0) bucket.receitas += tx.amount;
    else bucket.despesas += Math.abs(tx.amount);
    bucket.saldo = bucket.receitas - bucket.despesas;
  }

  return { data: [...buckets.values()], isLoading: transactions.isLoading };
}

/** Histórico de patrimônio salvo em snapshots mensais. */
export function useNetWorthSeries() {
  return useQuery({
    queryKey: ["net-worth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_snapshots")
        .select("month, net_worth")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        month: MONTH_LABELS[Number(row.month.slice(5, 7)) - 1] ?? row.month,
        value: Number(row.net_worth),
      }));
    },
  });
}

export type TaxSummary = {
  year: number;
  month: number;
  swing_gross: number;
  swing_exempt: boolean;
  swing_tax: number;
  daytrade_tax: number;
  fii_tax: number;
  dividends: number;
  withheld: number;
  darf_due: number;
};

/** Resumo de IRPF do mês, calculado no banco. */
export function useTaxSummary(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return useQuery({
    queryKey: ["taxes", year, month],
    queryFn: async (): Promise<TaxSummary> => {
      const { data, error } = await supabase.rpc("calculate_irpf_monthly", {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      return data as unknown as TaxSummary;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      description: string;
      amount: number;
      type: DbTransactionType;
      category: string;
      merchant?: string;
      accountId?: string | null;
      occurredAt: string;
    }) => {
      const userId = await requireUserId();
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        account_id: input.accountId ?? null,
        description: input.description,
        amount: input.amount,
        type: input.type,
        category: input.category,
        merchant: input.merchant ?? null,
        occurred_at: input.occurredAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from("transactions").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; category: string; planned: number }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        category: input.category,
        planned: input.planned,
        month: monthStart(),
      };
      const { error } = input.id
        ? await supabase.from("budgets").update(payload).eq("id", input.id)
        : await supabase.from("budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      targetAmount: number;
      currentAmount: number;
      deadline: string | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        title: input.title,
        target_amount: input.targetAmount,
        current_amount: input.currentAmount,
        deadline: input.deadline,
      };
      const { error } = input.id
        ? await supabase.from("goals").update(payload).eq("id", input.id)
        : await supabase.from("goals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpsertPayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      description: string;
      amount: number;
      dueDate: string;
      category?: string;
      barcode?: string | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        category: input.category ?? "Outros",
        barcode: input.barcode ?? null,
      };
      const { error } = input.id
        ? await supabase.from("payables").update(payload).eq("id", input.id)
        : await supabase.from("payables").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payables"] }),
  });
}

export function useSettlePayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payables").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payables"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Dados de exemplo                                                    */
/* ------------------------------------------------------------------ */

const demoPositions = [
  { ticker: "PETR4", name: "Petrobras PN", asset_class: "stock", quantity: 400, average_price: 34.2, current_price: 38.9 },
  { ticker: "ITSA4", name: "Itaúsa PN", asset_class: "stock", quantity: 900, average_price: 9.4, current_price: 10.8 },
  { ticker: "HGLG11", name: "CSHG Logística", asset_class: "fii", quantity: 120, average_price: 158.0, current_price: 171.2 },
  { ticker: "MXRF11", name: "Maxi Renda", asset_class: "fii", quantity: 1500, average_price: 10.1, current_price: 10.6 },
  { ticker: "TESOURO-IPCA-2029", name: "Tesouro IPCA+ 2029", asset_class: "fixed_income", quantity: 1, average_price: 92400, current_price: 98400 },
  { ticker: "IVVB11", name: "iShares S&P 500", asset_class: "etf", quantity: 190, average_price: 142.0, current_price: 158.9 },
] as const;

const demoTaxEvents = [
  { kind: "swing", asset_class: "stock", ticker: "PETR4", gross_amount: 12400, profit: 1240, withheld: 6.2 },
  { kind: "dividend", asset_class: "stock", ticker: "ITSA4", gross_amount: 860, profit: 0, withheld: 0 },
  { kind: "swing", asset_class: "fii", ticker: "MXRF11", gross_amount: 3200, profit: 240, withheld: 0 },
] as const;

/**
 * Popula a conta do usuário com um conjunto de dados de exemplo cobrindo
 * contas, transações, orçamento, metas, insights, investimentos, contas a
 * pagar/receber, eventos fiscais e histórico de patrimônio.
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

      // Replica as transações demo nos últimos 6 meses para alimentar gráficos.
      const transactionRows = [0, 1, 2, 3, 4, 5].flatMap((offset) =>
        demoTransactions.map((tx) => {
          const base = new Date();
          base.setMonth(base.getMonth() - offset);
          const day = Number(tx.date.slice(8, 10));
          const date = new Date(base.getFullYear(), base.getMonth(), Math.min(day, 28));
          const jitter = offset === 0 ? 1 : 0.85 + ((offset * 7) % 30) / 100;
          return {
            user_id: userId,
            account_id: accountIdByName.get(tx.accountName) ?? null,
            description: tx.description,
            merchant: tx.merchant,
            category: tx.category,
            type: ((tx.kind === "income"
              ? "income"
              : tx.kind === "transfer"
                ? "transfer"
                : "expense") satisfies DbTransactionType) as DbTransactionType,
            amount: Math.round(tx.amount * jitter * 100) / 100,
            occurred_at: date.toISOString().slice(0, 10),
          };
        }),
      );
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

      const { error: positionError } = await supabase.from("investment_positions").insert(
        demoPositions.map((position) => ({
          user_id: userId,
          account_id: accountIdByName.get("Carteira consolidada") ?? null,
          ticker: position.ticker,
          name: position.name,
          asset_class: position.asset_class,
          quantity: position.quantity,
          average_price: position.average_price,
          current_price: position.current_price,
        })),
      );
      if (positionError) throw positionError;

      const { error: payableError } = await supabase.from("payables").insert(
        demoBills.map((bill) => ({
          user_id: userId,
          description: bill.name,
          amount: bill.amount,
          due_date: bill.dueDate,
          category: "Contas",
          status: (bill.status === "SCHEDULED" ? "paid" : "pending") as BillStatus,
        })),
      );
      if (payableError) throw payableError;

      const { error: receivableError } = await supabase.from("receivables").insert([
        {
          user_id: userId,
          description: "Consultoria Axionn Tech",
          amount: 4800,
          due_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
          payer: "Axionn Tech LTDA",
        },
        {
          user_id: userId,
          description: "Reembolso plano de saúde",
          amount: 312.5,
          due_date: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
          payer: "Operadora",
        },
      ]);
      if (receivableError) throw receivableError;

      const { error: taxError } = await supabase.from("tax_events").insert(
        demoTaxEvents.map((event) => ({
          user_id: userId,
          kind: event.kind,
          asset_class: event.asset_class,
          ticker: event.ticker,
          gross_amount: event.gross_amount,
          profit: event.profit,
          withheld: event.withheld,
          occurred_at: new Date().toISOString().slice(0, 10),
        })),
      );
      if (taxError) throw taxError;

      const baseNetWorth = demoAccounts.reduce((total, account) => total + account.balance, 0);
      const snapshots = [5, 4, 3, 2, 1, 0].map((offset, index) => {
        const d = new Date();
        d.setMonth(d.getMonth() - offset);
        return {
          user_id: userId,
          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
          net_worth: Math.round(baseNetWorth * (0.86 + index * 0.028) * 100) / 100,
          liquidity: Math.round(baseNetWorth * 0.2 * (0.9 + index * 0.02) * 100) / 100,
        };
      });
      const { error: snapshotError } = await supabase.from("net_worth_snapshots").insert(snapshots);
      if (snapshotError) throw snapshotError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
