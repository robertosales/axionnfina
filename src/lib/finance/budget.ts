import { supabase } from "@/integrations/supabase/client";
import type { BudgetItem } from "@/shared/finance-types";
import { monthStart, requireUserId } from "./common";
import { daysUntil } from "@/lib/format";

export type BudgetAlert = {
  id: string;
  category: string;
  planned: number;
  spent: number;
  ratio: number;
  level: "warning" | "danger";
  daysUntilOver: number | null;
};

export type BillAlert = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntil: number;
  status: "overdue" | "due_soon" | "on_time";
};

export function checkBudgetAlerts(budgetItems: BudgetItem[]): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  for (const item of budgetItems) {
    if (item.planned <= 0) continue;
    const ratio = item.spent / item.planned;
    if (ratio >= 0.8) {
      alerts.push({
        id: item.id,
        category: item.category,
        planned: item.planned,
        spent: item.spent,
        ratio,
        level: ratio >= 1 ? "danger" : "warning",
        daysUntilOver: null,
      });
    }
  }
  return alerts;
}

export function checkBillAlerts(
  payables: Array<{ id: string; name: string; amount: number; dueDate: string; dbStatus: string }>,
): BillAlert[] {
  const alerts: BillAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const bill of payables) {
    if (bill.dbStatus === "paid") continue;
    const days = daysUntil(bill.dueDate);
    const status: BillAlert["status"] =
      days < 0 ? "overdue" : days <= 3 ? "due_soon" : "on_time";
    if (status === "overdue" || status === "due_soon") {
      alerts.push({
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        dueDate: bill.dueDate,
        daysUntil: days,
        status,
      });
    }
  }
  return alerts;
}

export async function fetchBudgetAlerts(): Promise<BudgetAlert[]> {
  const userId = await requireUserId();
  const month = monthStart();
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id, category, planned, month")
    .eq("month", month)
    .is("archived_at", null);

  if (!budgets?.length) return [];

  const { data: txs } = await supabase
    .from("transactions")
    .select("category, amount, type, occurred_at")
    .eq("user_id", userId)
    .gte("occurred_at", month)
    .eq("type", "expense");

  const items: BudgetItem[] = budgets.map((b) => {
    const spent = (txs ?? [])
      .filter((t) => t.category === b.category && t.type === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    return { id: b.id, category: b.category, planned: Number(b.planned), spent };
  });

  return checkBudgetAlerts(items);
}

export async function fetchBillAlerts(): Promise<BillAlert[]> {
  const userId = await requireUserId();
  const { data: payables } = await supabase
    .from("payables")
    .select("id, description, amount, due_date, status")
    .eq("user_id", userId)
    .not("status", "eq", "paid")
    .is("archived_at", null);

  if (!payables?.length) return [];

  return checkBillAlerts(
    payables.map((p) => ({
      id: p.id,
      name: p.description,
      amount: Number(p.amount),
      dueDate: p.due_date,
      dbStatus: p.status,
    })),
  );
}
