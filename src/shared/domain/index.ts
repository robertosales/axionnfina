/**
 * Shared Kernel — Domínio financeiro do Axionn Finance.
 *
 * Este módulo é a fonte única de verdade para enums, entidades e schemas Zod
 * usados tanto pela UI quanto pelas server functions. Não importa nada de
 * infraestrutura (Supabase, React) para poder rodar em qualquer ambiente.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const ACCOUNT_TYPES = ["checking", "savings", "credit", "investment"] as const;
export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;
export const INSIGHT_SEVERITIES = ["info", "warning", "critical"] as const;
export const ASSET_CLASSES = ["stock", "fii", "fixed_income", "crypto", "fund", "etf", "cash"] as const;
export const BILL_STATUSES = ["pending", "paid", "overdue", "canceled"] as const;
export const CONSENT_STATUSES = ["pending", "authorised", "revoked", "expired"] as const;
export const OPEN_FINANCE_SCOPES = [
  "accounts",
  "transactions",
  "credit_cards",
  "investments",
  "pix",
  "payment_initiation",
] as const;

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export const insightSeveritySchema = z.enum(INSIGHT_SEVERITIES);
export const assetClassSchema = z.enum(ASSET_CLASSES);
export const billStatusSchema = z.enum(BILL_STATUSES);
export const consentStatusSchema = z.enum(CONSENT_STATUSES);
export const openFinanceScopeSchema = z.enum(OPEN_FINANCE_SCOPES);

export type AccountTypeDb = z.infer<typeof accountTypeSchema>;
export type TransactionTypeDb = z.infer<typeof transactionTypeSchema>;
export type InsightSeverityDb = z.infer<typeof insightSeveritySchema>;
export type AssetClass = z.infer<typeof assetClassSchema>;
export type BillStatus = z.infer<typeof billStatusSchema>;
export type ConsentStatus = z.infer<typeof consentStatusSchema>;
export type OpenFinanceScope = z.infer<typeof openFinanceScopeSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD");

/* ------------------------------------------------------------------ */
/* Entidades                                                           */
/* ------------------------------------------------------------------ */

export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  institution: z.string(),
  type: accountTypeSchema,
  balance: z.number(),
  openFinance: z.boolean(),
  lastSyncAt: z.string().nullable(),
});
export type AccountEntity = z.infer<typeof accountSchema>;

export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  description: z.string().min(1),
  amount: z.number(),
  type: transactionTypeSchema,
  category: z.string(),
  merchant: z.string().nullable(),
  method: z.string().nullable(),
  occurredAt: isoDate,
});
export type TransactionEntity = z.infer<typeof transactionSchema>;

export const budgetSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1),
  planned: z.number().nonnegative(),
  month: isoDate,
});
export type BudgetEntity = z.infer<typeof budgetSchema>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  targetAmount: z.number().nonnegative(),
  currentAmount: z.number().nonnegative(),
  deadline: isoDate.nullable(),
});
export type GoalEntity = z.infer<typeof goalSchema>;

export const investmentPositionSchema = z.object({
  id: z.string().uuid(),
  ticker: z.string().min(1),
  name: z.string(),
  assetClass: assetClassSchema,
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
});
export type InvestmentPositionEntity = z.infer<typeof investmentPositionSchema>;

export const payableSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  amount: z.number(),
  dueDate: isoDate,
  status: billStatusSchema,
  category: z.string(),
  recurring: z.boolean(),
  barcode: z.string().nullable(),
  pixKey: z.string().nullable(),
  scheduledFor: z.string().nullable(),
});
export type PayableEntity = z.infer<typeof payableSchema>;

export const receivableSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  amount: z.number(),
  dueDate: isoDate,
  status: billStatusSchema,
  payer: z.string(),
  recurring: z.boolean(),
});
export type ReceivableEntity = z.infer<typeof receivableSchema>;

export const agentMemorySchema = z.object({
  id: z.string().uuid(),
  memoryType: z.string(),
  content: z.string().min(1),
  importance: z.number().min(0).max(1),
});
export type AgentMemoryEntity = z.infer<typeof agentMemorySchema>;

export const openFinanceConsentSchema = z.object({
  id: z.string().uuid(),
  institutionId: z.string().uuid(),
  status: consentStatusSchema,
  scopes: z.array(openFinanceScopeSchema),
  expiresAt: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
});
export type OpenFinanceConsentEntity = z.infer<typeof openFinanceConsentSchema>;

/* ------------------------------------------------------------------ */
/* Mapas de apresentação                                               */
/* ------------------------------------------------------------------ */

export const ACCOUNT_TYPE_LABEL = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit: "Cartão de crédito",
  investment: "Investimentos",
} as const satisfies Record<AccountTypeDb, string>;

export const ASSET_CLASS_LABEL = {
  stock: "Ações",
  fii: "FIIs",
  fixed_income: "Renda fixa",
  crypto: "Cripto",
  fund: "Fundos",
  etf: "ETFs",
  cash: "Caixa",
} as const satisfies Record<AssetClass, string>;

export const ASSET_CLASS_COLOR = {
  stock: "var(--color-chart-2)",
  fii: "var(--color-chart-4)",
  fixed_income: "var(--color-chart-1)",
  crypto: "var(--color-chart-5)",
  fund: "var(--color-chart-3)",
  etf: "var(--color-chart-5)",
  cash: "var(--color-transfer)",
} as const satisfies Record<AssetClass, string>;

export const BILL_STATUS_LABEL = {
  pending: "Pendente",
  paid: "Paga",
  overdue: "Atrasada",
  canceled: "Cancelada",
} as const satisfies Record<BillStatus, string>;

export const SCOPE_LABEL = {
  accounts: "Contas",
  transactions: "Transações",
  credit_cards: "Cartões de crédito",
  investments: "Investimentos",
  pix: "Pix",
  payment_initiation: "Iniciação de pagamento",
} as const satisfies Record<OpenFinanceScope, string>;
