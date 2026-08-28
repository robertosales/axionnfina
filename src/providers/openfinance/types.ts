/**
 * Open Finance — Tipos internos do Axionn.
 *
 * Nenhum tipo específico do provider deve vazar para fora deste módulo.
 * Todos os payloads externos são convertidos para estes modelos.
 */

/* ------------------------------------------------------------------ */
/* Connection Status                                                    */
/* ------------------------------------------------------------------ */

export type OpenFinanceConnectionStatus =
  | "pending"
  | "authenticating"
  | "active"
  | "degraded"
  | "expired"
  | "revoked"
  | "error"
  | "removed";

export type OpenFinanceConsentStatus =
  | "pending"
  | "authorised"
  | "rejected"
  | "expired"
  | "revoked"
  | "error";

/* ------------------------------------------------------------------ */
/* Scopes                                                               */
/* ------------------------------------------------------------------ */

export type OpenFinanceScope =
  | "accounts"
  | "balances"
  | "transactions"
  | "credit_cards"
  | "investments"
  | "investment_transactions"
  | "loans"
  | "payments"
  | "identity";

/* ------------------------------------------------------------------ */
/* Internal Models                                                      */
/* ------------------------------------------------------------------ */

export type OpenFinanceConnection = {
  id: string;
  user_id: string;
  institution_id: string;
  provider: string;
  provider_connection_id: string;
  status: OpenFinanceConnectionStatus;
  consent_status: OpenFinanceConsentStatus;
  consent_expires_at: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExternalInstitution = {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  organization: string | null;
  country: string;
};

export type ExternalAccount = {
  id: string;
  connection_id: string;
  institution_id: string;
  external_id: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  currency: string;
  status: string;
  is_manual: boolean;
  is_primary: boolean;
  current_balance: number;
  available_balance: number | null;
  credit_limit: number | null;
  last_synced_at: string | null;
};

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "investment"
  | "payment_account"
  | "brokerage"
  | "international"
  | "manual"
  | "other";

export type ExternalBalance = {
  account_id: string;
  current: number;
  available: number | null;
  currency: string;
  last_updated: string;
};

export type ExternalTransaction = {
  id: string;
  account_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string | null;
  merchant: string | null;
  mcc: string | null;
  method: string | null;
  status: string;
  occurred_at: string;
  booked_at: string | null;
  balance_after: number | null;
};

export type TransactionType = "income" | "expense" | "transfer";

export type ExternalCreditCard = {
  id: string;
  account_id: string;
  last_four: string;
  brand: string;
  holder_name: string;
  expiration_month: number | null;
  expiration_year: number | null;
  credit_limit: number;
  available_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  is_virtual: boolean;
};

export type ExternalInvestment = {
  id: string;
  account_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  quantity: number;
  average_price: number;
  current_price: number;
  market_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
};

export type ExternalInvestmentTransaction = {
  id: string;
  investment_id: string;
  type: string;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  tax: number;
  occurred_at: string;
};

/* ------------------------------------------------------------------ */
/* Sync Types                                                           */
/* ------------------------------------------------------------------ */

export type SyncResult = {
  success: boolean;
  accounts_imported: number;
  balances_imported: number;
  transactions_imported: number;
  investments_imported: number;
  duplicates_skipped: number;
  errors: SyncError[];
  duration_ms: number;
};

export type SyncError = {
  code: OpenFinanceErrorCode;
  message: string;
  entity: string;
  provider_error?: string;
};

/* ------------------------------------------------------------------ */
/* Error Codes                                                          */
/* ------------------------------------------------------------------ */

export type OpenFinanceErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "CONSENT_EXPIRED"
  | "CONSENT_REVOKED"
  | "PROVIDER_UNAVAILABLE"
  | "INSTITUTION_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE"
  | "SYNC_TIMEOUT"
  | "ACCOUNT_NOT_FOUND"
  | "TEMPORARY_ERROR"
  | "UNKNOWN";

/* ------------------------------------------------------------------ */
/* Provider Interface                                                   */
/* ------------------------------------------------------------------ */

export type ConnectInstitutionInput = {
  institution_id: string;
  scopes: OpenFinanceScope[];
  redirect_url: string;
};

export type ConnectInstitutionResult = {
  connection_id: string;
  provider_connection_id: string;
  auth_url: string | null;
  status: OpenFinanceConnectionStatus;
};

export type GetTransactionsInput = {
  connection_id: string;
  account_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
};

export type GetInvestmentTransactionsInput = {
  connection_id: string;
  investment_id?: string;
  from_date?: string;
  to_date?: string;
};

/**
 * OpenFinanceProvider — Interface abstrata para providers de Open Finance.
 *
 * Nenhum adapter deve ser usado diretamente fora deste módulo.
 * Toda comunicação com providers externos passa por esta interface.
 */
export interface OpenFinanceProvider {
  /** Identificador do provider (ex: 'pluggy', 'belvo', 'direct') */
  readonly providerId: string;

  /** Inicia conexão com instituição */
  connectInstitution(
    input: ConnectInstitutionInput,
  ): Promise<ConnectInstitutionResult>;

  /** Busca status de uma conexão */
  getConnection(
    providerConnectionId: string,
  ): Promise<OpenFinanceConnection>;

  /** Lista contas vinculadas à conexão */
  getAccounts(providerConnectionId: string): Promise<ExternalAccount[]>;

  /** Busca saldos das contas */
  getBalances(providerConnectionId: string): Promise<ExternalBalance[]>;

  /** Busca transações */
  getTransactions(input: GetTransactionsInput): Promise<ExternalTransaction[]>;

  /** Busca cartões de crédito (quando disponível) */
  getCreditCards?(
    providerConnectionId: string,
  ): Promise<ExternalCreditCard[]>;

  /** Busca investimentos (quando disponível) */
  getInvestments?(
    providerConnectionId: string,
  ): Promise<ExternalInvestment[]>;

  /** Busca transações de investimentos */
  getInvestmentTransactions?(
    input: GetInvestmentTransactionsInput,
  ): Promise<ExternalInvestmentTransaction[]>;

  /** Revoga conexão/consentimento */
  revokeConnection(providerConnectionId: string): Promise<void>;

  /** Sincroniza dados da conexão */
  syncConnection(providerConnectionId: string): Promise<SyncResult>;

  /** Processa evento de webhook */
  handleWebhook(payload: unknown): Promise<WebhookEvent>;
}

/* ------------------------------------------------------------------ */
/* Webhook                                                              */
/* ------------------------------------------------------------------ */

export type WebhookEventType =
  | "connection_created"
  | "connection_updated"
  | "connection_error"
  | "connection_revoked"
  | "consent_expired"
  | "account_updated"
  | "transactions_updated"
  | "investments_updated"
  | "sync_completed"
  | "sync_failed";

export type WebhookEvent = {
  event_type: WebhookEventType;
  provider_connection_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
};
