/**
 * Open Finance — Feature Flags e configuração.
 *
 * Controla habilitação de funcionalidades por ambiente.
 */

export type OpenFinanceConfig = {
  enabled: boolean;
  provider: string;
  investmentsEnabled: boolean;
  paymentsEnabled: boolean;
  syncIntervalMinutes: number;
  maxRetries: number;
  webhookSecret: string | null;
};

/**
 * Lê configuração de feature flags do ambiente.
 */
export function getOpenFinanceConfig(): OpenFinanceConfig {
  return {
    enabled: process.env["OPEN_FINANCE_ENABLED"] === "true",
    provider: process.env["OPENFINANCE_PROVIDER"] ?? "pluggy",
    investmentsEnabled: process.env["OPEN_FINANCE_INVESTMENTS_ENABLED"] === "true",
    paymentsEnabled: process.env["OPEN_FINANCE_PAYMENTS_ENABLED"] === "true",
    syncIntervalMinutes: parseInt(process.env["OPEN_FINANCE_SYNC_INTERVAL"] ?? "360", 10),
    maxRetries: parseInt(process.env["OPEN_FINANCE_MAX_RETRIES"] ?? "3", 10),
    webhookSecret: process.env["PLUGGY_WEBHOOK_SECRET"] ?? null,
  };
}

/**
 * Verifica se uma funcionalidade está habilitada.
 */
export function isFeatureEnabled(
  feature: "investments" | "payments" | "sync",
): boolean {
  const config = getOpenFinanceConfig();
  if (!config.enabled) return false;

  switch (feature) {
    case "investments":
      return config.investmentsEnabled;
    case "payments":
      return config.paymentsEnabled;
    case "sync":
      return true;
    default:
      return false;
  }
}
