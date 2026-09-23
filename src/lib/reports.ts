import type { Account, Transaction } from "@/shared/finance-types";

export const REPORT_PRESETS = ["current", "previous", "quarter", "year", "custom"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export type ReportTab = "overview" | "expenses" | "wealth" | "credit";

export type ReportTransaction = Transaction & {
  method: string | null;
  subcategory: string | null;
};

export type ReportFilters = {
  start: string;
  end: string;
  accountId: string | null;
};

export type MonthlyFlow = {
  key: string;
  month: string;
  income: number;
  expenses: number;
  result: number;
  savingsRate: number | null;
};

export type CategoryBreakdown = {
  category: string;
  value: number;
  percent: number;
  previousValue: number;
  average3m: number;
  change: number | null;
  transactions: ReportTransaction[];
};

export type WealthPoint = {
  month: string;
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  liquidity: number;
  complete: boolean;
};

export type ReportMetrics = {
  income: number;
  expenses: number;
  result: number;
  savingsRate: number | null;
  previousIncome: number;
  previousExpenses: number;
  previousResult: number;
  incomeChange: number | null;
  expenseChange: number | null;
  resultChange: number | null;
  monthly: MonthlyFlow[];
  categories: CategoryBreakdown[];
  topExpenses: ReportTransaction[];
  methods: Array<{ method: string; value: number; percent: number }>;
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

export function dateRangeForPreset(preset: ReportPreset, now = new Date()): Pick<ReportFilters, "start" | "end"> {
  const year = now.getFullYear();
  const month = now.getMonth();
  const format = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  if (preset === "previous") {
    return { start: format(new Date(year, month - 1, 1)), end: format(new Date(year, month, 0)) };
  }
  if (preset === "quarter") {
    return { start: format(new Date(year, month - 2, 1)), end: format(now) };
  }
  if (preset === "year") return { start: `${year}-01-01`, end: format(now) };
  return { start: format(new Date(year, month, 1)), end: format(now) };
}

function previousRange(filters: ReportFilters) {
  const start = new Date(`${filters.start}T12:00:00`);
  const end = new Date(`${filters.end}T12:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: iso(previousStart), end: iso(previousEnd) };
}

function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
}

function isOperational(transaction: ReportTransaction) {
  return transaction.kind !== "transfer" && transaction.kind !== "investment" && !transaction.pending && !transaction.archivedAt;
}

export function calculateReportMetrics(transactions: ReportTransaction[], filters: ReportFilters): ReportMetrics {
  const accountMatches = (transaction: ReportTransaction) => !filters.accountId || transaction.accountId === filters.accountId;
  const inRange = (transaction: ReportTransaction, start: string, end: string) => {
    const date = transaction.date.slice(0, 10);
    return date >= start && date <= end;
  };
  const operational = transactions.filter((transaction) => isOperational(transaction) && accountMatches(transaction));
  const current = operational.filter((transaction) => inRange(transaction, filters.start, filters.end));
  const previousDates = previousRange(filters);
  const previous = operational.filter((transaction) => inRange(transaction, previousDates.start, previousDates.end));
  const totals = (rows: ReportTransaction[]) => {
    const income = rows.filter((row) => row.kind === "income" && row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
    const expenses = rows.filter((row) => row.kind === "expense" && row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);
    return { income, expenses, result: income - expenses };
  };
  const total = totals(current);
  const previousTotal = totals(previous);

  const monthBuckets = new Map<string, MonthlyFlow>();
  const cursor = new Date(`${filters.start}T12:00:00`);
  const end = new Date(`${filters.end}T12:00:00`);
  cursor.setDate(1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, { key, month: `${MONTHS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`, income: 0, expenses: 0, result: 0, savingsRate: null });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const transaction of current) {
    const bucket = monthBuckets.get(transaction.date.slice(0, 7));
    if (!bucket) continue;
    if (transaction.kind === "income" && transaction.amount > 0) bucket.income += transaction.amount;
    if (transaction.kind === "expense" && transaction.amount < 0) bucket.expenses += Math.abs(transaction.amount);
    bucket.result = bucket.income - bucket.expenses;
    bucket.savingsRate = bucket.income > 0 ? (bucket.result / bucket.income) * 100 : null;
  }

  const expenses = current.filter((row) => row.kind === "expense" && row.amount < 0);
  const previousExpenses = previous.filter((row) => row.kind === "expense" && row.amount < 0);
  const categoryMap = new Map<string, ReportTransaction[]>();
  for (const transaction of expenses) {
    const category = transaction.category.trim() || "Sem categoria";
    categoryMap.set(category, [...(categoryMap.get(category) ?? []), transaction]);
  }
  const categoryTotal = expenses.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const threeMonthsStart = new Date(`${filters.start}T12:00:00`);
  threeMonthsStart.setMonth(threeMonthsStart.getMonth() - 3);
  const threeMonthsStartIso = threeMonthsStart.toISOString().slice(0, 10);
  const categories = [...categoryMap.entries()].map(([category, rows]) => {
    const value = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
    const previousValue = previousExpenses.filter((row) => (row.category.trim() || "Sem categoria") === category).reduce((sum, row) => sum + Math.abs(row.amount), 0);
    const average3m = operational.filter((row) => row.kind === "expense" && row.amount < 0 && row.date.slice(0, 10) >= threeMonthsStartIso && row.date.slice(0, 10) < filters.start && (row.category.trim() || "Sem categoria") === category).reduce((sum, row) => sum + Math.abs(row.amount), 0) / 3;
    return { category, value, percent: categoryTotal > 0 ? (value / categoryTotal) * 100 : 0, previousValue, average3m, change: percentChange(value, previousValue), transactions: rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) };
  }).sort((a, b) => b.value - a.value);

  const methodMap = new Map<string, number>();
  for (const transaction of expenses) {
    const method = normalizePaymentMethod(transaction.method);
    methodMap.set(method, (methodMap.get(method) ?? 0) + Math.abs(transaction.amount));
  }
  const methods = [...methodMap.entries()].map(([method, value]) => ({ method, value, percent: categoryTotal > 0 ? (value / categoryTotal) * 100 : 0 })).sort((a, b) => b.value - a.value);

  return {
    ...total,
    savingsRate: total.income > 0 ? (total.result / total.income) * 100 : null,
    previousIncome: previousTotal.income,
    previousExpenses: previousTotal.expenses,
    previousResult: previousTotal.result,
    incomeChange: percentChange(total.income, previousTotal.income),
    expenseChange: percentChange(total.expenses, previousTotal.expenses),
    resultChange: percentChange(total.result, previousTotal.result),
    monthly: [...monthBuckets.values()],
    categories,
    topExpenses: [...expenses].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10),
    methods,
  };
}

export function normalizePaymentMethod(method: string | null): string {
  const value = method?.toLowerCase().trim() ?? "";
  if (value.includes("pix")) return "Pix";
  if (value.includes("debit") || value.includes("débito")) return "Débito";
  if (value.includes("installment") || value.includes("parcel")) return "Crédito parcelado";
  if (value.includes("credit") || value.includes("crédito")) return "Crédito à vista";
  return "Não identificado";
}

export function buildExecutiveInsights(metrics: ReportMetrics): string[] {
  const insights: string[] = [];
  if (metrics.savingsRate === null) insights.push("Não há receita confirmada suficiente para calcular a taxa de poupança.");
  else if (metrics.savingsRate >= 20) insights.push(`A taxa de poupança foi de ${metrics.savingsRate.toFixed(1).replace(".", ",")}% no período, dentro da faixa excelente.`);
  else if (metrics.savingsRate >= 10) insights.push(`A taxa de poupança foi de ${metrics.savingsRate.toFixed(1).replace(".", ",")}%, dentro da faixa saudável.`);
  else insights.push(`A taxa de poupança foi de ${metrics.savingsRate.toFixed(1).replace(".", ",")}%, abaixo do nível de atenção de 10%.`);
  const offender = metrics.categories[0];
  if (offender) insights.push(`${offender.category} concentrou ${offender.percent.toFixed(0)}% das despesas do período.`);
  if (metrics.expenseChange !== null) insights.push(`As despesas ${metrics.expenseChange > 0 ? "subiram" : "caíram"} ${Math.abs(metrics.expenseChange).toFixed(1).replace(".", ",")}% frente ao período anterior equivalente.`);
  else insights.push("Ainda não há base anterior equivalente para comparar as despesas.");
  return insights.slice(0, 3);
}

export function savingsTone(rate: number | null): "danger" | "warning" | "success" | "default" {
  if (rate === null) return "default";
  if (rate < 10) return "danger";
  if (rate < 20) return "warning";
  return "success";
}

export function accountLabel(account: Account): string {
  return `${account.institution} · ${account.name}`;
}
