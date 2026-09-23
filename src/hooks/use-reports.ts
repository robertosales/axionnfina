import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReportFilters, ReportTransaction, WealthPoint } from "@/lib/reports";
import type { DbTransactionType } from "@/lib/finance/common";

export type ReportBudget = { category: string; planned: number; month: string };
export type ReportInvoice = { id: string; cardId: string; referenceMonth: string; dueDate: string | null; total: number; status: string };
export type ReportInvoiceItem = { invoiceId: string; amount: number; installment: string | null; description: string; purchaseDate: string };
export type ReportDestination = { month: string; savings: number; investments: number; checking: number };

export function useReportData(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-center", filters],
    queryFn: async () => {
      const historyStart = new Date(`${filters.start}T12:00:00`);
      historyStart.setMonth(historyStart.getMonth() - 3);
      const historyIso = historyStart.toISOString().slice(0, 10);
      const firstMonth = `${filters.start.slice(0, 7)}-01`;
      const endMonth = new Date(`${filters.end.slice(0, 7)}-01T12:00:00`);
      endMonth.setMonth(endMonth.getMonth() + 1);
      const nextMonth = endMonth.toISOString().slice(0, 10);
      const [transactionsResult, categoriesResult, snapshotsResult, balancesResult, budgetsResult, invoicesResult, invoiceItemsResult, piggyResult, investmentsResult] = await Promise.all([
        supabase.from("transactions").select("id, account_id, description, merchant, merchant_name, category, category_id, subcategory_id, method, type, amount, occurred_at, status, is_recurring, archived_at, record_origin, accounts(name)").gte("occurred_at", historyIso).lte("occurred_at", `${filters.end}T23:59:59`).is("archived_at", null).order("occurred_at", { ascending: false }),
        supabase.from("transaction_categories").select("id, label, name"),
        supabase.from("net_worth_snapshots").select("month, net_worth, liquidity").gte("month", `${historyStart.getFullYear() - 2}-01-01`).order("month"),
        supabase.from("account_balances").select("account_id, balance, snapshot_date").gte("snapshot_date", `${historyStart.getFullYear() - 2}-01-01`).order("snapshot_date"),
        supabase.from("budgets").select("category, planned, month").gte("month", firstMonth).lt("month", nextMonth).is("archived_at", null),
        supabase.from("credit_card_invoices").select("id, card_id, reference_month, due_date, total_amount, status").gte("reference_month", firstMonth).lt("reference_month", nextMonth),
        supabase.from("credit_card_invoice_items").select("invoice_id, amount, installment, description, purchase_date").gte("purchase_date", filters.start).lte("purchase_date", filters.end),
        supabase.from("piggy_bank_movements").select("amount, date, type").gte("date", filters.start).lte("date", filters.end),
        supabase.from("investment_transactions").select("net_amount, gross_amount, occurred_at, type").gte("occurred_at", filters.start).lte("occurred_at", `${filters.end}T23:59:59`),
      ]);
      const results = [transactionsResult, categoriesResult, snapshotsResult, balancesResult, budgetsResult, invoicesResult, invoiceItemsResult, piggyResult, investmentsResult];
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      const categoryNames = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name ?? category.label]));
      const transactions: ReportTransaction[] = (transactionsResult.data ?? []).map((row) => ({
        id: row.id, description: row.description, merchant: row.merchant_name ?? row.merchant ?? "", category: row.category || "Sem categoria",
        kind: row.type as DbTransactionType, amount: Number(row.amount), date: row.occurred_at, accountName: row.accounts?.name ?? "—", accountId: row.account_id,
        pending: row.status === "pending", status: row.status, isRecurring: row.is_recurring, archivedAt: row.archived_at,
        ...(row.record_origin ? { recordOrigin: row.record_origin as NonNullable<ReportTransaction["recordOrigin"]> } : {}), method: row.method,
        subcategory: row.subcategory_id ? categoryNames.get(row.subcategory_id) ?? null : null,
      }));
      const wealth: WealthPoint[] = (snapshotsResult.data ?? []).map((row) => ({
        month: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(`${row.month}T12:00:00`)),
        date: row.month, assets: Math.max(Number(row.net_worth), 0), liabilities: Math.max(-Number(row.net_worth), 0), netWorth: Number(row.net_worth), liquidity: Number(row.liquidity), complete: true,
      }));
      const negativeDays = new Set((balancesResult.data ?? []).filter((row) => (!filters.accountId || row.account_id === filters.accountId) && Number(row.balance) < 0).map((row) => row.snapshot_date)).size;
      const maxOverdraft = (balancesResult.data ?? []).filter((row) => !filters.accountId || row.account_id === filters.accountId).reduce((max, row) => Math.max(max, Number(row.balance) < 0 ? Math.abs(Number(row.balance)) : 0), 0);
      const destinations = new Map<string, ReportDestination>();
      for (const row of piggyResult.data ?? []) {
        const month = row.date.slice(0, 7); const item = destinations.get(month) ?? { month, savings: 0, investments: 0, checking: 0 };
        item.savings += row.type === "deposit" ? Number(row.amount) : -Number(row.amount); destinations.set(month, item);
      }
      for (const row of investmentsResult.data ?? []) {
        const month = row.occurred_at.slice(0, 7); const item = destinations.get(month) ?? { month, savings: 0, investments: 0, checking: 0 };
        const amount = Number(row.net_amount ?? row.gross_amount); item.investments += row.type.toLowerCase().includes("sell") || row.type.toLowerCase().includes("resgat") ? -amount : amount; destinations.set(month, item);
      }
      return {
        transactions, wealth, budgets: (budgetsResult.data ?? []).map((row) => ({ category: row.category, planned: Number(row.planned), month: row.month })) as ReportBudget[],
        invoices: (invoicesResult.data ?? []).map((row) => ({ id: row.id, cardId: row.card_id, referenceMonth: row.reference_month, dueDate: row.due_date, total: Number(row.total_amount), status: row.status })) as ReportInvoice[],
        invoiceItems: (invoiceItemsResult.data ?? []).map((row) => ({ invoiceId: row.invoice_id, amount: Number(row.amount), installment: row.installment, description: row.description, purchaseDate: row.purchase_date })) as ReportInvoiceItem[],
        destinations: [...destinations.values()].sort((a, b) => a.month.localeCompare(b.month)), negativeDays, maxOverdraft,
      };
    },
  });
}
