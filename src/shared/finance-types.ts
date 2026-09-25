/**
 * Tipos de apresentação financeira usados pelas telas e adaptadores.
 *
 * NOTA: Estes tipos são derivados do schema do banco de dados,
 * mas definidos localmente para evitar acoplamento com @/integrations/supabase/types.
 * Se o schema mudar, estes tipos devem ser atualizados manualmente.
 */

/** Status de uma transação */
export type TransactionStatus = "pending" | "settled" | "cancelled" | "failed" | "reversed";

/** Tipo de conta bancária */
export type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT";

/** Classificação da transação */
export type TransactionKind = "income" | "expense" | "transfer" | "investment";

/** Origem do registro */
export type RecordOrigin = "manual" | "open_finance" | "import" | "system";

/** Conta bancária */
export type Account = {
  id: string;
  institution: string;
  name: string;
  type: AccountType;
  balance: number;
  /** Limite de cheque especial contratado (apenas contas correntes). */
  creditLimit?: number | null;
  lastSyncedAt: string | null;
  connectionId?: string | null;
  recordOrigin?: RecordOrigin;
  openFinance: boolean;
  branch?: string;
  accountNumber?: string;
  logoUrl?: string | null;
};

/** Transação financeira */
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
  recordOrigin?: RecordOrigin;
};

/** Item de orçamento */
export type BudgetItem = {
  id: string;
  category: string;
  planned: number;
  spent: number;
  rollover?: number;
  archivedAt?: string | null;
  recordOrigin?: RecordOrigin;
};

/** Meta financeira */
export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  dueDate: string;
  monthlySuggestion: number;
  archivedAt?: string | null;
  recordOrigin?: RecordOrigin;
};

/** Conta a pagar/receber */
export type UpcomingBill = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  status: "SCHEDULED" | "PENDING" | "OVERDUE";
  archivedAt?: string | null;
  recordOrigin?: RecordOrigin;
};

/** Insight do agente */
export type AgentInsight = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "danger";
  archivedAt?: string | null;
  recordOrigin?: RecordOrigin;
};
