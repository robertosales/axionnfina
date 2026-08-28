/**
 * Open Finance — Catálogo de erros internos.
 *
 * Mapeia códigos de erro internos para mensagens amigáveis ao usuário.
 * Erros brutos do provider NUNCA são expostos diretamente.
 */

import type { OpenFinanceErrorCode } from "./types";

type ErrorDefinition = {
  message: string;
  userMessage: string;
  severity: "low" | "medium" | "high" | "critical";
  retryable: boolean;
};

export const ERROR_CATALOG: Record<OpenFinanceErrorCode, ErrorDefinition> = {
  AUTHENTICATION_REQUIRED: {
    message: "Autenticação bancária necessária",
    userMessage: "É necessário reautenticar no banco. Clique em 'Renovar conexão'.",
    severity: "high",
    retryable: true,
  },
  CONSENT_EXPIRED: {
    message: "Consentimento expirado",
    userMessage: "O consentimento expirou. Reconecte a instituição.",
    severity: "medium",
    retryable: true,
  },
  CONSENT_REVOKED: {
    message: "Consentimento revogado",
    userMessage: "O consentimento foi revogado. Reconecte a instituição.",
    severity: "medium",
    retryable: true,
  },
  PROVIDER_UNAVAILABLE: {
    message: "Provider indisponível",
    userMessage: "O serviço de integração está temporariamente indisponível. Tente novamente em alguns minutos.",
    severity: "high",
    retryable: true,
  },
  INSTITUTION_UNAVAILABLE: {
    message: "Instituição indisponível",
    userMessage: "Esta instituição está temporariamente fora do ar. Tente novamente mais tarde.",
    severity: "medium",
    retryable: true,
  },
  RATE_LIMITED: {
    message: "Limite de requisições atingido",
    userMessage: "Muitas requisições. Aguarde alguns minutos e tente novamente.",
    severity: "low",
    retryable: true,
  },
  INVALID_RESPONSE: {
    message: "Resposta inválida do provider",
    userMessage: "Ocorreu um erro na comunicação com o banco. Tente novamente.",
    severity: "high",
    retryable: true,
  },
  SYNC_TIMEOUT: {
    message: "Timeout na sincronização",
    userMessage: "A sincronização demorou mais que o esperado. Tente novamente.",
    severity: "medium",
    retryable: true,
  },
  ACCOUNT_NOT_FOUND: {
    message: "Conta não encontrada",
    userMessage: "A conta não foi encontrada na instituição.",
    severity: "low",
    retryable: false,
  },
  TEMPORARY_ERROR: {
    message: "Erro temporário",
    userMessage: "Ocorreu um erro temporário. Tente novamente.",
    severity: "medium",
    retryable: true,
  },
  UNKNOWN: {
    message: "Erro desconhecido",
    userMessage: "Ocorreu um erro inesperado. Se persistir, entre em contato com o suporte.",
    severity: "high",
    retryable: false,
  },
};

/**
 * Obtém definição de erro amigável ao usuário.
 */
export function getErrorDefinition(code: OpenFinanceErrorCode): ErrorDefinition {
  return ERROR_CATALOG[code] ?? ERROR_CATALOG.UNKNOWN;
}

/**
 * Mapeia erro do provider para código interno.
 */
export function mapProviderError(
  providerError: string,
  providerId: string,
): OpenFinanceErrorCode {
  const errorMap: Record<string, Record<string, OpenFinanceErrorCode>> = {
    pluggy: {
      INVALID_CONNECTOR: "INSTITUTION_UNAVAILABLE",
      INVALID_CREDENTIALS: "AUTHENTICATION_REQUIRED",
      CONSENT_REQUIRED: "CONSENT_EXPIRED",
      CONSENT_REVOKED: "CONSENT_REVOKED",
      TIMEOUT: "SYNC_TIMEOUT",
      RATE_LIMITED: "RATE_LIMITED",
      SERVER_ERROR: "PROVIDER_UNAVAILABLE",
    },
    belvo: {
      INVALID_CREDENTIALS: "AUTHENTICATION_REQUIRED",
      CONNECTION_ERROR: "TEMPORARY_ERROR",
      INSTITUTION_UNAVAILABLE: "INSTITUTION_UNAVAILABLE",
    },
  };

  const providerMap = errorMap[providerId];
  if (!providerMap) return "UNKNOWN";

  return providerMap[providerError] ?? "UNKNOWN";
}

/**
 * Registra erro de sync no banco de dados.
 */
export async function logSyncError(params: {
  connection_id: string;
  provider: string;
  error_code: OpenFinanceErrorCode;
  message: string;
  entity: string;
  provider_error?: string;
}): Promise<void> {
  // Será implementado com a migration de sync_errors
  console.error("[OpenFinanceSync]", params);
}
