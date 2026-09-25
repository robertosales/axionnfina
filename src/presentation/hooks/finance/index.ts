/**
 * Finance Hooks - Data access hooks para operações financeiras
 *
 * Estes hooks encapsulam queries Supabase e transformação de dados.
 * São a camada de apresentação que conecta UI ao backend.
 */

// Re-exports dos hooks existentes
export * from "@/lib/finance/accounts";
export * from "@/lib/finance/bills";
export * from "@/lib/finance/budget";
export * from "@/lib/finance/funds";
export * from "@/lib/finance/investments";
export * from "@/lib/finance/lifecycle";
export * from "@/lib/finance/loans";
export * from "@/lib/finance/notifications";
export * from "@/lib/finance/planning";
export * from "@/lib/finance/projects";
export * from "@/lib/finance/savings";
export * from "@/lib/finance/summary";
export * from "@/lib/finance/tags";
export * from "@/lib/finance/taxes";
export * from "@/lib/finance/transactions";

// Common utilities
export { monthStart, requireUserId } from "@/lib/finance/common";
export type { DbAccountType, DbTransactionType, DbSeverity } from "@/lib/finance/common";
export { dbToUiAccountType, uiToDbAccountType, severityToUi, MONTH_LABELS } from "@/lib/finance/common";

// New hooks
export { useFundComparisons } from "@/lib/finance/funds";
export { useLoans, useUpsertLoan, useSettleLoan, useArchiveLoan, calculateLoanInterest, calculateEarlyPayoff } from "@/lib/finance/loans";
export { useProjects, useUpsertProject, useUpdateProjectProgress, useArchiveProject } from "@/lib/finance/projects";
export { useNotifications, useUnreadNotificationsCount, useMarkNotificationRead, useMarkAllNotificationsRead, useUpsertNotification } from "@/lib/finance/notifications";
export { checkBudgetAlerts, checkBillAlerts, fetchBudgetAlerts, fetchBillAlerts } from "@/lib/finance/budget";
