import type { Database } from "@/integrations/supabase/types";

/** Contratos de apresentação financeira usados pelas telas e adaptadores. */
export type TransactionStatus = Database["public"]["Enums"]["transaction_status"];
export type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT";
export type TransactionKind = "income" | "expense" | "transfer" | "investment";

export type Account = {
  id: string;
  institution: string;
  name: string;
  type: AccountType;
  balance: number;
  lastSyncedAt: string | null;
  connectionId?: string | null;
  recordOrigin?: "manual" | "open_finance" | "import" | "system";
  openFinance: boolean;
  branch?: string;
  accountNumber?: string;
};

export type Transaction = {
  id: string;
  description: string;
  merchant: string;
  category: string;
  kind: TransactionKind;
  amount: number;
  date: string;
  accountName: string;
  accountId?: string | null;
  pending?: boolean;
  status?: TransactionStatus;
  isRecurring?: boolean;
  archivedAt?: string | null;
  recordOrigin?: "manual" | "open_finance" | "import" | "system";
};

export type BudgetItem = {
  id: string;
  category: string;
  planned: number;
  spent: number;
  rollover?: number;
  archivedAt?: string | null;
  recordOrigin?: "manual" | "open_finance" | "import" | "system";
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  dueDate: string;
  monthlySuggestion: number;
  archivedAt?: string | null;
  recordOrigin?: "manual" | "open_finance" | "import" | "system";
};

export type UpcomingBill = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  status: "SCHEDULED" | "PENDING" | "OVERDUE";
  archivedAt?: string | null;
  recordOrigin?: "manual" | "open_finance" | "import" | "system";
};

export type AgentInsight = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "danger";
  archivedAt?: string | null;
  recordOrigin?: "manual" | "open_finance" | "import" | "system";
};
