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
