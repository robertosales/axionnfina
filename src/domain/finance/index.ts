/**
 * Finance Domain - Regras de negócio financeiras puras
 */

// Algoritmos e cálculos
export { calculateFinancialHealth } from "@/lib/financial-health";
export { parseFinancialInput, formatFinancialInput } from "@/lib/financial-input";
export { analyzeFinancialReadiness } from "@/lib/financial-next-step";
export { calculateFgcExposure } from "@/lib/fgc-exposure";
export { calculateWealthSummary } from "@/lib/wealth-summary";
export { calculateOverdraft } from "@/lib/overdraft";

// Regras de negócio
export { detectSavingsOpportunities } from "@/lib/savings-opportunities";
export { generateReport } from "@/lib/reports";

// Formatação (pura - sem side effects)
export { formatCurrency, formatPercent, formatDateTime } from "@/lib/format";

// Tipos de visualização
export * from "@/lib/transaction-view";

// Validação
export { validateBoleto } from "@/lib/boleto";

// Importação de dados (parsing puro)
export { parseStatementCsv } from "@/lib/statement-import";
export { parseDocument } from "@/lib/document-import";

// Re-exports do shared
export type {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  AccountType,
  Institution,
  InvestmentType,
  InvestmentRisk,
  GoalStatus,
  BudgetPeriod,
} from "@/shared/domain";
