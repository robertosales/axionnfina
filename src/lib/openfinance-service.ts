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
  ExternalCreditCard,
  ExternalInvestment,
  WebhookEvent,
} from "@/providers/openfinance/types";
import { getErrorDefinition } from "@/providers/openfinance/errors";

/* ------------------------------------------------------------------ */
/* Provider Registry                                                    */
/* ------------------------------------------------------------------ */

const PROVIDERS: Record<string, () => OpenFinanceProvider> = {
  pluggy: () => new PluggyAdapter(),
};

function getProvider(name?: string): OpenFinanceProvider {
  const providerName = name ?? process.env.OPENFINANCE_PROVIDER ?? "pluggy";
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
  return process.env.OPEN_FINANCE_ENABLED === "true";
}

export function isOpenFinanceInvestmentsEnabled(): boolean {
  return process.env.OPEN_FINANCE_INVESTMENTS_ENABLED === "true";
}

export function isOpenFinancePaymentsEnabled(): boolean {
  return process.env.OPEN_FINANCE_PAYMENTS_ENABLED === "true";
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
    redirect_url: `${process.env.APP_URL ?? "http://localhost:3000"}/wallet/connect/callback`,
  });

  // Persistir conexão
  const { error } = await supabase.from("account_connections").insert({
    user_id: userId,
    institution_id: institutionId,
    provider: provider.providerId,
    provider_connection_id: result.provider_connection_id,
    status: result.status,
    metadata: { scopes },
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

  const provider = getProvider(data.provider);
  try {
    return await provider.getConnection(data.provider_connection_id);
  } catch (err) {
    console.error("[OpenFinanceService] Failed to get connection status:", err);
    return null;
  }
}

export async function revokeConnection(
  userId: string,
  connectionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("account_connections")
    .select("provider, provider_connection_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return false;

  const provider = getProvider(data.provider);
  try {
    await provider.revokeConnection(data.provider_connection_id);

    await supabase
      .from("account_connections")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
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

export async function syncConnection(
  userId: string,
  connectionId: string,
): Promise<SyncResult> {
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
      errors: [{ code: "ACCOUNT_NOT_FOUND", message: "Connection not found", entity: "connection" }],
      duration_ms: Date.now() - start,
    };
  }

  const provider = getProvider(conn.provider);
  const syncResult = await provider.syncConnection(conn.provider_connection_id);

  // Persistir contas importadas
  if (syncResult.accounts_imported > 0) {
    const accounts = await provider.getAccounts(conn.provider_connection_id);
    await persistAccounts(userId, connectionId, conn.institution_id, accounts);
  }

  // Persistir saldos
  if (syncResult.balances_imported > 0) {
    const balances = await provider.getBalances(conn.provider_connection_id);
    await persistBalances(userId, balances);
  }

  // Persistir transações
  if (syncResult.transactions_imported > 0) {
    const transactions = await provider.getTransactions({
      connection_id: conn.provider_connection_id,
    });
    await persistTransactions(userId, transactions);
  }

  // Persistir investimentos (quando disponível)
  if (syncResult.investments_imported > 0 && provider.getInvestments) {
    const investments = await provider.getInvestments(conn.provider_connection_id);
    await persistInvestments(userId, connectionId, investments);
  }

  // Atualizar status da conexão
  await supabase
    .from("account_connections")
    .update({
      status: syncResult.success ? "active" : "error",
      last_synced_at: new Date().toISOString(),
      last_successful_sync_at: syncResult.success
        ? new Date().toISOString()
        : conn.last_successful_sync_at,
      last_error_at: syncResult.success ? null : new Date().toISOString(),
      last_error_code: syncResult.success ? null : syncResult.errors[0]?.code ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  // Registrar sync
  await supabase.from("openfinance_syncs").insert({
    connection_id: connectionId,
    provider: conn.provider,
    status: syncResult.success ? "completed" : "failed",
    accounts_imported: syncResult.accounts_imported,
    balances_imported: syncResult.balances_imported,
    transactions_imported: syncResult.transactions_imported,
    investments_imported: syncResult.investments_imported,
    duplicates_skipped: syncResult.duplicates_skipped,
    duration_ms: syncResult.duration_ms,
    errors: syncResult.errors,
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
        type: acc.type,
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

async function persistBalances(
  userId: string,
  balances: ExternalBalance[],
): Promise<void> {
  for (const bal of balances) {
    // Buscar account pelo external_id
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("external_id", bal.account_id)
      .eq("user_id", userId)
      .single();

    if (account) {
      await supabase.rpc("create_balance_snapshot", {
        p_account_id: account.id,
        p_balance: bal.current,
        p_available_balance: bal.available,
      });
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
        asset_class: inv.asset_class,
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

export async function handleWebhook(
  provider: string,
  payload: unknown,
): Promise<void> {
  const adapter = getProvider(provider);
  const event = await adapter.handleWebhook(payload);

  // Registrar evento
  const payloadHash = await hashPayload(JSON.stringify(payload));
  const { data: existing } = await supabase
    .from("provider_webhook_events")
    .select("id")
    .eq("provider", provider)
    .eq("external_event_id", `${event.provider_connection_id}:${event.event_type}`)
    .single();

  if (existing) {
    // Evento duplicado — ignorar
    return;
  }

  await supabase.from("provider_webhook_events").insert({
    provider,
    external_event_id: `${event.provider_connection_id}:${event.event_type}`,
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
          status: event.event_type === "connection_revoked" ? "revoked" : "error",
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("provider_connection_id", event.provider_connection_id);
      break;

    case "sync_completed":
    case "account_updated":
    case "transactions_updated":
    case "investments_updated":
      // Trigger sync automático
      const { data: conn } = await supabase
        .from("account_connections")
        .select("id, user_id")
        .eq("provider_connection_id", event.provider_connection_id)
        .single();

      if (conn) {
        await syncConnection(conn.user_id, conn.id);
      }
      break;
  }
}

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
