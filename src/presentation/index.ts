/**
 * Presentation Layer - Hooks, componentes e rotas
 *
 * Este módulo contém toda a camada de apresentação:
 * - React hooks
 * - Componentes UI
 * - Rotas e layouts
 *
 * Regras:
 * - Pode importar de @/domain/ (para tipos e regras)
 * - Pode importar de @/application/ (para casos de uso)
 * - Pode importar de @/infrastructure/ (para clientes)
 * - É a única camada que pode usar React
 */

// Hooks de dados (data access)
export * from "@/presentation/hooks/finance";

// Hooks de UI
export * from "@/hooks/use-masking";
export * from "@/hooks/use-mobile";

// Hooks de segurança
export * from "@/hooks/use-security";
export * from "@/hooks/use-mfa";
export * from "@/hooks/use-step-up-auth";

// Hooks de domínio
export * from "@/hooks/use-session-user";
export * from "@/hooks/use-openfinance";
export * from "@/hooks/use-realtime";
export * from "@/hooks/use-reports";
export * from "@/hooks/use-piggy-banks";
export * from "@/hooks/use-wallet";
export * from "@/hooks/use-anomaly-detection";
export * from "@/hooks/use-lgpd";
