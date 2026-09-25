/**
 * Presentation Hooks - Hooks React para UI
 *
 * Este módulo contém todos os hooks React organizados por domínio.
 * Cada hook encapsula lógica de UI, data fetching ou estado.
 */

// Finance hooks
export * from "./finance";

// Security hooks
export * from "@/hooks/use-security";
export * from "@/hooks/use-mfa";
export * from "@/hooks/use-step-up-auth";

// Domain hooks
export * from "@/hooks/use-session-user";
export * from "@/hooks/use-openfinance";
export * from "@/hooks/use-realtime";
export * from "@/hooks/use-reports";
export * from "@/hooks/use-piggy-banks";
export { useWalletSummary, useArchivedAccounts, useArchiveAccount, useSetPrimaryAccount, useAccountBalances, useCreateBalanceSnapshot, useAccountConnections, useCreateConnection, useCreditCards, useInvoiceCardOptions } from "@/hooks/use-wallet";
export * from "@/hooks/use-anomaly-detection";
export * from "@/hooks/use-lgpd";

// UI hooks
export * from "@/hooks/use-masking";
export * from "@/hooks/use-mobile";
