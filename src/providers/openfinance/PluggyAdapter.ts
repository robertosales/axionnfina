/**
 * Pluggy Adapter — Implementação do OpenFinanceProvider para a API Pluggy.
 *
 * Referência: https://docs.pluggy.ai/
 *
 * Regras:
 * - Nunca logar access_token ou client_secret
 * - Nunca expor erros brutos do provider ao frontend
 * - Usar mapeador (mapper.ts) para converter payloads externos
 * - Tratar rate limits com backoff
 */

import {
  type ConnectInstitutionInput,
  type ConnectInstitutionResult,
  type GetTransactionsInput,
  type GetInvestmentTransactionsInput,
  type OpenFinanceConnection,
  type OpenFinanceProvider,
  type ExternalAccount,
  type ExternalBalance,
  type ExternalTransaction,
  type ExternalCreditCard,
  type ExternalInvestment,
  type SyncResult,
  type WebhookEvent,
} from "./types";
import {
  mapPluggyAccounts,
  mapPluggyBalances,
  mapPluggyTransactions,
  mapPluggyInvestments,
} from "./mapper";
import { mapProviderError } from "./errors";

/* ------------------------------------------------------------------ */
/* Config                                                               */
/* ------------------------------------------------------------------ */

const PLUGGY_BASE_URL = "https://api.pluggy.ai";
const PLUGGY_VERSION = "2024-01-31";

type PluggyConfig = {
  clientId: string;
  clientSecret: string;
};

function getConfig(): PluggyConfig {
  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

/* ------------------------------------------------------------------ */
/* HTTP Client                                                          */
/* ------------------------------------------------------------------ */

let cachedApiKey: string | null = null;
let apiKeyExpiresAt = 0;

async function getApiKey(): Promise<string> {
  if (cachedApiKey && Date.now() < apiKeyExpiresAt) {
    return cachedApiKey;
  }

  const { clientId, clientSecret } = getConfig();
  const res = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`Pluggy auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedApiKey = data.apiKey;
  apiKeyExpiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000 - 60_000;
  return cachedApiKey!;
}

async function pluggyFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = await getApiKey();
  const res = await fetch(`${PLUGGY_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      "Pluggy-Version": PLUGGY_VERSION,
      ...options.headers,
    },
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMITED");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* Pluggy Types                                                         */
/* ------------------------------------------------------------------ */

type PluggyConnectTokenResponse = {
  id: string;
  accessToken: string;
  webhookUrl?: string;
};

type PluggyItemResponse = {
  id: string;
  status: string;
  connector: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

type PluggyAccountResponse = {
  id: string;
  connectorId: string;
  name: string;
  type: string;
  subtype: string | null;
  currencyCode: string;
  status: string;
  balance: number;
  owned?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type PluggyBalanceResponse = {
  results: Array<{
    accountId: string;
    amount: number;
    currency: string;
    date: string;
    type: string;
  }>;
};

type PluggyTransactionResponse = {
  results: Array<{
    id: string;
    accountId: string;
    description: string;
    amount: number;
    type: string;
    category: string | null;
    merchant: string | null;
    mcc: number | null;
    status: string;
    date: string;
    createdAt?: string;
    balance?: number;
  }>;
  total: number;
};

type PluggyInvestmentResponse = {
  results: Array<{
    id: string;
    accountId: string;
    type: string;
    name: string;
    ticker: string;
    quantity: number;
    price: number;
    balance: number;
    taxes?: number;
    netValue?: number;
  }>;
};

/* ------------------------------------------------------------------ */
/* Adapter Implementation                                               */
/* ------------------------------------------------------------------ */

export class PluggyAdapter implements OpenFinanceProvider {
  readonly providerId = "pluggy";

  async connectInstitution(
    input: ConnectInstitutionInput,
  ): Promise<ConnectInstitutionResult> {
    const data = await pluggyFetch<PluggyConnectTokenResponse>(
      "/connect_token",
      {
        method: "POST",
        body: JSON.stringify({
          connectorId: input.institution_id,
          webhookUrl: `${process.env["APP_URL"] ?? "http://localhost:3000"}/api/webhooks/openfinance/pluggy`,
        }),
      },
    );

    return {
      connection_id: data.id,
      provider_connection_id: data.id,
      auth_url: null, // Pluggy uses embedded widget, not redirect
      status: "pending",
    };
  }

  async getConnection(
    providerConnectionId: string,
  ): Promise<OpenFinanceConnection> {
    const data = await pluggyFetch<PluggyItemResponse>(
      `/items/${providerConnectionId}`,
    );

    const statusMap: Record<string, OpenFinanceConnection["status"]> = {
      UPDATED: "active",
      WAITING_USER_INPUT: "authenticating",
      LOGIN_IN_PROGRESS: "authenticating",
      CREATED: "pending",
      ERROR: "error",
      DISABLED: "revoked",
      OUTDATED: "expired",
      SYNCING: "active",
    };

    return {
      id: data.id,
      user_id: "", // Preenchido pelo service
      institution_id: data.connector?.id ?? "",
      provider: "pluggy",
      provider_connection_id: data.id,
      status: statusMap[data.status] ?? "error",
      consent_status: "authorised",
      consent_expires_at: null,
      last_synced_at: data.updatedAt ?? null,
      last_successful_sync_at: null,
      last_error_at: data.status === "ERROR" ? data.updatedAt : null,
      last_error_code: data.status === "ERROR" ? "TEMPORARY_ERROR" : null,
      metadata: {},
      created_at: data.createdAt ?? new Date().toISOString(),
      updated_at: data.updatedAt ?? new Date().toISOString(),
    };
  }

  async getAccounts(providerConnectionId: string): Promise<ExternalAccount[]> {
    const data = await pluggyFetch<{ results: PluggyAccountResponse[] }>(
      `/accounts?itemId=${providerConnectionId}`,
    );
    return mapPluggyAccounts(data.results ?? []);
  }

  async getBalances(providerConnectionId: string): Promise<ExternalBalance[]> {
    const data = await pluggyFetch<PluggyBalanceResponse>(
      `/balances?itemId=${providerConnectionId}`,
    );
    return mapPluggyBalances(data.results ?? []);
  }

  async getTransactions(
    input: GetTransactionsInput,
  ): Promise<ExternalTransaction[]> {
    const params = new URLSearchParams({
      itemId: input.connection_id,
    });
    if (input.account_id) params.set("accountId", input.account_id);
    if (input.from_date) params.set("from", input.from_date);
    if (input.to_date) params.set("to", input.to_date);
    if (input.limit) params.set("limit", String(input.limit));
    if (input.offset) params.set("offset", String(input.offset));

    const data = await pluggyFetch<PluggyTransactionResponse>(
      `/transactions?${params.toString()}`,
    );
    return mapPluggyTransactions(data.results ?? []);
  }

  async getCreditCards(
    providerConnectionId: string,
  ): Promise<ExternalCreditCard[]> {
    try {
      const data = await pluggyFetch<{
        results: Array<{
          id: string;
          accountId: string;
          lastFourDigits: string;
          brandName: string;
          holderName?: string;
          expirationMonth?: number;
          expirationYear?: number;
          creditLimit?: number;
          availableCreditLimit?: number;
          closingDay?: number;
          dueDay?: number;
        }>;
      }>(`/credit_cards?itemId=${providerConnectionId}`);

      return (data.results ?? []).map((card) => ({
        id: card.id,
        account_id: card.accountId,
        last_four: card.lastFourDigits ?? "0000",
        brand: card.brandName ?? "other",
        holder_name: card.holderName ?? "",
        expiration_month: card.expirationMonth ?? null,
        expiration_year: card.expirationYear ?? null,
        credit_limit: card.creditLimit ?? 0,
        available_limit: card.availableCreditLimit ?? null,
        closing_day: card.closingDay ?? null,
        due_day: card.dueDay ?? null,
        is_virtual: false,
      }));
    } catch {
      return [];
    }
  }

  async getInvestments(
    providerConnectionId: string,
  ): Promise<ExternalInvestment[]> {
    try {
      const data = await pluggyFetch<PluggyInvestmentResponse>(
        `/investments?itemId=${providerConnectionId}`,
      );
      return mapPluggyInvestments(data.results ?? []);
    } catch {
      return [];
    }
  }

  async getInvestmentTransactions(
    input: GetInvestmentTransactionsInput,
  ): Promise<never[]> {
    // Pluggy não suporta transações de investimentos diretamente
    return [];
  }

  async revokeConnection(providerConnectionId: string): Promise<void> {
    try {
      await pluggyFetch(`/items/${providerConnectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DISABLED" }),
      });
    } catch (err) {
      console.error("[PluggyAdapter] Revoke failed:", err);
    }
  }

  async syncConnection(providerConnectionId: string): Promise<SyncResult> {
    const start = Date.now();
    const errors: SyncResult["errors"] = [];
    let accounts_imported = 0;
    let balances_imported = 0;
    let transactions_imported = 0;
    let investments_imported = 0;
    const duplicates_skipped = 0;

    try {
      // Sync accounts
      const accounts = await this.getAccounts(providerConnectionId);
      accounts_imported = accounts.length;

      // Sync balances
      const balances = await this.getBalances(providerConnectionId);
      balances_imported = balances.length;

      // Sync transactions (paginated)
      let offset = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const transactions = await this.getTransactions({
          connection_id: providerConnectionId,
          limit,
          offset,
        });
        transactions_imported += transactions.length;
        offset += limit;
        hasMore = transactions.length === limit;
      }

      // Sync investments (optional)
      try {
        const investments = await this.getInvestments(providerConnectionId);
        investments_imported = investments.length;
      } catch {
        // Investments not supported by this connector
      }

      return {
        success: true,
        accounts_imported,
        balances_imported,
        transactions_imported,
        investments_imported,
        duplicates_skipped,
        errors,
        duration_ms: Date.now() - start,
      };
    } catch (err) {
      const errorCode = mapProviderError(
        (err as Error).message,
        this.providerId,
      );
      errors.push({
        code: errorCode,
        message: (err as Error).message,
        entity: "sync",
      });

      return {
        success: false,
        accounts_imported,
        balances_imported,
        transactions_imported,
        investments_imported,
        duplicates_skipped,
        errors,
        duration_ms: Date.now() - start,
      };
    }
  }

  async handleWebhook(payload: unknown): Promise<WebhookEvent> {
    const data = payload as {
      event?: string;
      eventId?: string;
      itemId?: string;
      type?: string;
      data?: Record<string, unknown>;
    };

    const eventTypeMap: Record<string, WebhookEvent["event_type"]> = {
      "item/created": "connection_created",
      "item/updated": "connection_updated",
      "item/error": "connection_error",
      "item/deleted": "connection_revoked",
      "accounts/created": "account_updated",
      "accounts/updated": "account_updated",
      "transactions/created": "transactions_updated",
      "transactions/updated": "transactions_updated",
      "investments/created": "investments_updated",
      "investments/updated": "investments_updated",
    };

    return {
      external_event_id: data.eventId ?? "",
      event_type: eventTypeMap[data.event ?? data.type ?? ""] ?? "sync_completed",
      provider_connection_id: data.itemId ?? "",
      timestamp: new Date().toISOString(),
      payload: data as Record<string, unknown>,
    };
  }
}
