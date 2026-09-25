import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DbJson = Database["public"]["Tables"]["investment_plans"]["Row"]["allocations"];

export const dbToUiAccountType = {
  checking: "CHECKING",
  savings: "SAVINGS",
  credit: "CREDIT_CARD",
  investment: "INVESTMENT",
} as const;

export const uiToDbAccountType = {
  CHECKING: "checking",
  SAVINGS: "savings",
  CREDIT_CARD: "credit",
  INVESTMENT: "investment",
} as const;

export type DbAccountType = keyof typeof dbToUiAccountType;

export type DbTransactionType = "income" | "expense" | "transfer";

export type DbSeverity = "info" | "warning" | "critical";

export const severityToUi = {
  info: "info",
  warning: "warning",
  critical: "danger",
} as const;

export const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user.id;
}

/** Linha de banco sem tipagem gerada (tabelas novas até regenerar types do Supabase). */
export type DbRow = Record<string, unknown>;

export function rowStr(row: DbRow, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

export function rowNum(row: DbRow, key: string, fallback = 0): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type UntypedQueryResult = {
  data: DbRow[] | null;
  error: { message?: string } | null;
  count?: number | null;
};

/** Subconjunto thenable do query builder do Supabase para tabelas sem tipo gerado. */
export interface UntypedQuery {
  select: (columns?: string, options?: Record<string, unknown>) => UntypedQuery;
  insert: (values: unknown) => UntypedQuery;
  update: (values: unknown) => UntypedQuery;
  delete: () => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  not: (column: string, operator: string, value: unknown) => UntypedQuery;
  is: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: Record<string, unknown>) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  then: <TResult1 = UntypedQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: UntypedQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ) => Promise<TResult1 | TResult2>;
}

export type UntypedDb = {
  from: (table: string) => UntypedQuery;
};

/** Acesso a tabelas ainda sem tipo gerado no Supabase (com RLS por user_id). */
export function untypedDb(): UntypedDb {
  return supabase as unknown as UntypedDb;
}
