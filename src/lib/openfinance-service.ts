/**
 * OpenFinanceService — Serviço de orquestração do Open Finance.
 *
 * Coordena: conexão, consentimento, sincronização, normalização, persistência.
 * Nunca acessa APIs externas diretamente — sempre passa pelo provider.
 */

import { supabase } from "@/integrations/supabase/client";
import { PluggyAdapter } from "@/providers/openfinance/PluggyAdapter";
import type {
  OpenFinanceProvider,
  OpenFinanceConnection,
  OpenFinanceScope,
  ConnectInstitutionResult,
  SyncResult,
  ExternalAccount,
  ExternalBalance,
  ExternalTransaction,
  ExternalInvestment,
  WebhookEvent,
} from "@/providers/openfinance/types";
import { getErrorDefinition } from "@/providers/openfinance/errors";
import type { Database, Json } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/* Provider Registry                                                    */
/* ------------------------------------------------------------------ */

const PROVIDERS: Record<string, () => OpenFinanceProvider> = {
  pluggy: () => new PluggyAdapter(),
};

function getProvider(name?: string): OpenFinanceProvider {
  const providerName = name ?? process.env["OPENFINANCE_PROVIDER"] ?? "pluggy";
  const factory = PROVIDERS[providerName];
  if (!factory) {
    throw new Error(`Unknown Open Finance provider: ${providerName}`);
  }
  return factory();
}

/* ------------------------------------------------------------------ */
/* Feature Flags                                                        */
/* ------------------------------------------------------------------ */

export function isOpenFinanceEnabled(): boolean {
  return process.env["OPEN_FINANCE_ENABLED"] === "true";
}

export function isOpenFinanceInvestmentsEnabled(): boolean {
  return process.env["OPEN_FINANCE_INVESTMENTS_ENABLED"] === "true";
}

export function isOpenFinancePaymentsEnabled(): boolean {
  return process.env["OPEN_FINANCE_PAYMENTS_ENABLED"] === "true";
}

/* ------------------------------------------------------------------ */
/* Status Mapping                                                       */
/* ------------------------------------------------------------------ */

type DbConnectionStatus = Database["public"]["Enums"]["connection_status"];

function mapProviderStatusToDb(status: OpenFinanceConnection["status"]): DbConnectionStatus {
  switch (status) {
    case "active":
    case "degraded":
    case "authenticating":
      return "active";
    case "pending":
      return "pending";
    case "error":
      return "error";
    case "expired":
    case "revoked":
    case "removed":
    case "inactive":
      return "inactive";
    default:
      return "error";
  }
}

function mapDbStatusToProvider(status: DbConnectionStatus): OpenFinanceConnection["status"] {
  switch (status) {
    case "active":
      return "active";
    case "pending":
      return "pending";
    case "error":
      return "error";
    case "inactive":
      return "inactive";
    default:
      return "error";
  }
}

/* ------------------------------------------------------------------ */
/* Metadata Helpers                                                     */
/* ------------------------------------------------------------------ */

function getProviderConnectionId(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "provider_connection_id" in metadata) {
    const value = (metadata as Record<string, unknown>)["provider_connection_id"];
    return typeof value === "string" ? value : null;
  }
  return null;
}

function buildConnectionMetadata(
  providerConnectionId: string,
  extra: Record<string, Json | undefined> = {},
): Json {
  return { provider_connection_id: providerConnectionId, ...extra };
}

function mapAccountType(
  type: ExternalAccount["type"],
): Database["public"]["Enums"]["account_type"] {
  switch (type) {
    case "savings":
      return "savings";
    case "credit_card":
      return "credit";
    case "investment":
    case "brokerage":
      return "investment";
    default:
      return "checking";
  }
}

/* ------------------------------------------------------------------ */
/* Connection Management                                                */
/* ------------------------------------------------------------------ */

export async function connectInstitution(
  userId: string,
  institutionId: string,
  scopes: OpenFinanceScope[],
): Promise<ConnectInstitutionResult> {
  const provider = getProvider();

  const result = await provider.connectInstitution({
    institution_id: institutionId,
    scopes,
    redirect_url: `${process.env["APP_URL"] ?? "http://localhost:3000"}/wallet/connect/callback`,
  });

  // Persistir conexão
  const { error } = await supabase.from("account_connections").insert({
    user_id: userId,
    institution_id: institutionId,
    external_provider: provider.providerId,
    status: mapProviderStatusToDb(result.status),
    metadata: buildConnectionMetadata(result.provider_connection_id, { scopes }) as Json,
  });

  if (error) {
    console.error("[OpenFinanceService] Failed to persist connection:", error);
  }

  return result;
}

export async function getConnectionStatus(
  userId: string,
  connectionId: string,
): Promise<OpenFinanceConnection | null> {
  const { data, error } = await supabase
    .from("account_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  const providerConnectionId = getProviderConnectionId(data.metadata);
  if (!providerConnectionId) return null;

  const provider = getProvider(data.external_provider);
  try {
    const providerConn = await provider.getConnection(providerConnectionId);
    return {
      ...providerConn,
      id: data.id,
      user_id: userId,
      institution_id: data.institution_id,
      status: mapDbStatusToProvider(data.status),
      last_successful_sync_at: null,
    };
  } catch (err) {
    console.error("[OpenFinanceService] Failed to get connection status:", err);
    return null;
  }
}

export async function revokeConnection(userId: string, connectionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("account_connections")
    .select("external_provider, metadata")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return false;

  const providerConnectionId = getProviderConnectionId(data.metadata);
  if (!providerConnectionId) return false;

  const provider = getProvider(data.external_provider);
  try {
    await provider.revokeConnection(providerConnectionId);

    await supabase
      .from("account_connections")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", connectionId);

    return true;
  } catch (err) {
    console.error("[OpenFinanceService] Revoke failed:", err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Sync Engine                                                          */
/* ------------------------------------------------------------------ */

export async function syncConnection(userId: string, connectionId: string): Promise<SyncResult> {
  const start = Date.now();

  const { data: conn, error: connError } = await supabase
    .from("account_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (connError || !conn) {
    return {
      success: false,
      accounts_imported: 0,
      balances_imported: 0,
      transactions_imported: 0,
      investments_imported: 0,
      duplicates_skipped: 0,
      errors: [
        { code: "ACCOUNT_NOT_FOUND", message: "Connection not found", entity: "connection" },
      ],
      duration_ms: Date.now() - start,
    };
  }

  const providerConnectionId = getProviderConnectionId(conn.metadata);
  if (!providerConnectionId) {
    return {
      success: false,
      accounts_imported: 0,
      balances_imported: 0,
      transactions_imported: 0,
      investments_imported: 0,
      duplicates_skipped: 0,
      errors: [
        {
          code: "ACCOUNT_NOT_FOUND",
          message: "Provider connection id missing",
          entity: "connection",
        },
      ],
      duration_ms: Date.now() - start,
    };
  }

  const provider = getProvider(conn.external_provider);
  const syncResult = await provider.syncConnection(providerConnectionId);

  // Persistir contas importadas
  if (syncResult.accounts_imported > 0) {
    const accounts = await provider.getAccounts(providerConnectionId);
    await persistAccounts(userId, connectionId, conn.institution_id, accounts);
  }

  // Persistir saldos
  if (syncResult.balances_imported > 0) {
    const balances = await provider.getBalances(providerConnectionId);
    await persistBalances(userId, balances);
  }

  // Persistir transações
  if (syncResult.transactions_imported > 0) {
    const transactions = await provider.getTransactions({
      connection_id: providerConnectionId,
    });
    await persistTransactions(userId, transactions);
  }

  // Persistir investimentos (quando disponível)
  if (syncResult.investments_imported > 0 && provider.getInvestments) {
    const investments = await provider.getInvestments(providerConnectionId);
    await persistInvestments(userId, connectionId, investments);
  }

  // Atualizar status da conexão
  await supabase
    .from("account_connections")
    .update({
      status: syncResult.success ? "active" : "error",
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  // Registrar sync
  await supabase.from("openfinance_syncs").insert({
    connection_id: connectionId,
    provider: conn.external_provider,
    status: syncResult.success ? "completed" : "failed",
    accounts_imported: syncResult.accounts_imported,
    balances_imported: syncResult.balances_imported,
    transactions_imported: syncResult.transactions_imported,
    investments_imported: syncResult.investments_imported,
    duplicates_skipped: syncResult.duplicates_skipped,
    duration_ms: syncResult.duration_ms,
    errors: JSON.parse(JSON.stringify(syncResult.errors)) as Json,
  });

  return syncResult;
}

/* ------------------------------------------------------------------ */
/* Persist Functions                                                    */
/* ------------------------------------------------------------------ */

async function persistAccounts(
  userId: string,
  connectionId: string,
  institutionId: string,
  accounts: ExternalAccount[],
): Promise<void> {
  for (const acc of accounts) {
    await supabase.rpc("upsert_account", {
      p_data: {
        name: acc.name,
        institution_id: institutionId,
        type: mapAccountType(acc.type),
        balance: acc.current_balance,
        available_balance: acc.available_balance,
        credit_limit: acc.credit_limit,
        currency: acc.currency,
        subtype: acc.subtype,
        is_primary: acc.is_primary,
        is_manual: false,
        open_finance: true,
        external_id: acc.external_id,
        metadata: { connection_id: connectionId, provider_account_id: acc.id },
      },
    });
  }
}

async function persistBalances(userId: string, balances: ExternalBalance[]): Promise<void> {
  for (const bal of balances) {
    // Buscar account pelo external_id
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("external_id", bal.account_id)
      .eq("user_id", userId)
      .single();

    if (account) {
      const snapshotArgs: Database["public"]["Functions"]["create_balance_snapshot"]["Args"] = {
        p_account_id: account.id,
        p_balance: bal.current,
      };
      if (bal.available !== null) snapshotArgs.p_available_balance = bal.available;
      await supabase.rpc("create_balance_snapshot", snapshotArgs);
    }
  }
}

async function persistTransactions(
  userId: string,
  transactions: ExternalTransaction[],
): Promise<void> {
  for (const tx of transactions) {
    // Buscar account pelo external_id
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("external_id", tx.account_id)
      .eq("user_id", userId)
      .single();

    if (account) {
      await supabase.rpc("upsert_transaction_idempotent", {
        p_idempotency_key: tx.id,
        p_data: {
          account_id: account.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type === "income" ? "income" : tx.type === "transfer" ? "transfer" : "expense",
          category: tx.category ?? "Outros",
          merchant: tx.merchant,
          method: tx.method,
          occurred_at: tx.occurred_at,
        },
      });
    }
  }
}

const ASSET_CLASS_MAP: Record<string, Database["public"]["Enums"]["asset_class"]> = {
  stock: "stock",
  fii: "fii",
  fixed_income: "fixed_income",
  crypto: "crypto",
  fund: "fund",
  etf: "etf",
  cash: "cash",
};

async function persistInvestments(
  userId: string,
  connectionId: string,
  investments: ExternalInvestment[],
): Promise<void> {
  for (const inv of investments) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("external_id", inv.account_id)
      .eq("user_id", userId)
      .single();

    await supabase.from("investment_positions").upsert(
      {
        user_id: userId,
        account_id: account?.id ?? null,
        ticker: inv.ticker,
        name: inv.name,
        asset_class: ASSET_CLASS_MAP[inv.asset_class] ?? "stock",
        quantity: inv.quantity,
        average_price: inv.average_price,
        current_price: inv.current_price,
      },
      { onConflict: "user_id,ticker" },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Webhook Handler                                                      */
/* ------------------------------------------------------------------ */

export async function handleWebhook(provider: string, payload: unknown): Promise<void> {
  const adapter = getProvider(provider);
  const event = await adapter.handleWebhook(payload);

  // Registrar evento
  const payloadHash = await hashPayload(JSON.stringify(payload));
  const { data: existing } = await supabase
    .from("provider_webhook_events")
    .select("id")
    .eq("provider", provider)
    .eq("external_event_id", event.external_event_id)
    .single();

  if (existing) {
    // Evento duplicado — ignorar
    return;
  }

  await supabase.from("provider_webhook_events").insert({
    provider,
    external_event_id: event.external_event_id,
    event_type: event.event_type,
    status: "received",
    payload_hash: payloadHash,
  });

  // Processar evento
  switch (event.event_type) {
    case "connection_error":
    case "connection_revoked":
    case "consent_expired":
      await supabase
        .from("account_connections")
        .update({
          status: event.event_type === "connection_revoked" ? "inactive" : "error",
          error_message:
            event.event_type === "connection_revoked" ? "Revogado pelo usuário" : "Erro na conexão",
          updated_at: new Date().toISOString(),
        })
        .contains("metadata", { provider_connection_id: event.provider_connection_id });
      break;

    case "sync_completed":
    case "account_updated":
    case "transactions_updated":
    case "investments_updated": {
      // Trigger sync automático
      const { data: conn } = await supabase
        .from("account_connections")
        .select("id, user_id")
        .contains("metadata", { provider_connection_id: event.provider_connection_id })
        .single();

      if (conn) {
        await syncConnection(conn.user_id, conn.id);
      }
      break;
    }
  }
}

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
