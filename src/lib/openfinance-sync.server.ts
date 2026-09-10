import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import {
  deletePluggyItem,
  getAllPluggyTransactions,
  getAllPluggyInvestments,
  getAllPluggyInvestmentTransactions,
  getPluggyAccounts,
  getPluggyItem,
  type PluggyAccount,
  type PluggyTransaction,
} from "@/lib/pluggy.server";
import { normalizeInvestmentPosition } from "@/lib/investment-import";
import { logEvent } from "@/lib/observability.server";

type AuthenticatedClient = SupabaseClient<Database>;

export type OpenFinanceSyncResult = {
  success: boolean;
  accountsImported: number;
  transactionsImported: number;
  duplicatesSkipped: number;
  investmentsImported: number;
  investmentTransactionsImported: number;
};

function accountType(account: PluggyAccount): Database["public"]["Enums"]["account_type"] {
  if (account.type === "CREDIT" || account.subtype === "CREDIT_CARD") return "credit";
  if (account.subtype === "SAVINGS_ACCOUNT") return "savings";
  return "checking";
}

function textValue(
  value: string | { name?: string | null; description?: string | null } | null | undefined,
) {
  if (typeof value === "string") return value;
  return value?.name ?? value?.description ?? null;
}

function transactionValues(transaction: PluggyTransaction) {
  const providerType = transaction.type?.toUpperCase() ?? "";
  const isTransfer = providerType.includes("TRANSFER");
  const isDebit = providerType === "DEBIT" || providerType === "EXPENSE";
  const isCredit = providerType === "CREDIT" || providerType === "INCOME";
  const amount = isDebit
    ? -Math.abs(transaction.amount)
    : isCredit
      ? Math.abs(transaction.amount)
      : transaction.amount;
  const type = isTransfer ? "transfer" : amount < 0 ? "expense" : "income";
  const status = transaction.status?.toUpperCase() === "PENDING" ? "pending" : "settled";

  return {
    amount,
    type: type as Database["public"]["Enums"]["transaction_type"],
    status: status as Database["public"]["Enums"]["transaction_status"],
    category: textValue(transaction.category) ?? "Outros",
    merchant: textValue(transaction.merchant),
  };
}

export async function registerPluggyConnection(
  supabase: AuthenticatedClient,
  userId: string,
  institutionId: string,
  itemId: string,
): Promise<{ connectionId: string; sync: OpenFinanceSyncResult }> {
  const item = await getPluggyItem(itemId);
  if (item.clientUserId && item.clientUserId !== userId) {
    throw new Error("A conexão retornada não pertence ao usuário autenticado.");
  }

  const { data: existing } = await supabase
    .from("account_connections")
    .select("id")
    .eq("user_id", userId)
    .contains("metadata", { provider_connection_id: item.id })
    .maybeSingle();

  let connectionId = existing?.id;
  if (!connectionId) {
    const { data: consent, error: consentError } = await supabase
      .from("openfinance_consents")
      .insert({
        user_id: userId,
        institution_id: institutionId,
        scopes: [
          "accounts",
          "balances",
          "transactions",
          "credit_cards",
          "investments",
          "investment_transactions",
        ],
        status: "authorised",
        consent_id: item.id,
        last_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (consentError) throw consentError;

    const { data: connection, error: connectionError } = await supabase
      .from("account_connections")
      .insert({
        user_id: userId,
        institution_id: institutionId,
        consent_id: consent.id,
        consent_status: "authorised",
        external_provider: "pluggy",
        status: "pending",
        metadata: {
          provider_connection_id: item.id,
          connector_id: item.connector.id,
          connector_name: item.connector.name,
        },
      })
      .select("id")
      .single();
    if (connectionError) throw connectionError;
    connectionId = connection.id;
  }

  const sync = await syncPluggyConnection(supabase, userId, connectionId);
  return { connectionId, sync };
}

export async function syncPluggyConnection(
  supabase: AuthenticatedClient,
  userId: string,
  connectionId: string,
): Promise<OpenFinanceSyncResult> {
  const startedAt = Date.now();
  const { data: connection, error: connectionError } = await supabase
    .from("account_connections")
    .select(
      "id, institution_id, external_provider, metadata, status, consent_status, consent_expires_at",
    )
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();
  if (connectionError || connection.external_provider !== "pluggy") {
    throw connectionError ?? new Error("Conexão Open Finance inválida.");
  }
  if (
    connection.status === "inactive" ||
    connection.consent_status === "revoked" ||
    connection.consent_status === "expired" ||
    (connection.consent_expires_at && Date.parse(connection.consent_expires_at) <= Date.now())
  ) {
    throw new Error("Renove o consentimento antes de sincronizar.");
  }

  const metadata = connection.metadata as Record<string, unknown> | null;
  const itemId = metadata?.["provider_connection_id"];
  if (typeof itemId !== "string") throw new Error("Item Pluggy ausente na conexão.");

  try {
    const item = await getPluggyItem(itemId);
    if (item.clientUserId && item.clientUserId !== userId)
      throw new Error("Item de outro usuário.");
    const accounts = await getPluggyAccounts(itemId);
    let transactionsImported = 0;
    let duplicatesSkipped = 0;
    let investmentsImported = 0;
    let investmentTransactionsImported = 0;

    for (const account of accounts) {
      if (!Number.isFinite(account.balance)) throw new Error("Invalid provider balance");
      const accountPayload = {
        user_id: userId,
        name: account.marketingName ?? account.name,
        institution: item.connector.name,
        institution_id: connection.institution_id,
        type: accountType(account),
        balance: account.balance,
        current_balance: account.balance,
        available_balance: account.creditData?.availableCreditLimit ?? account.balance ?? 0,
        credit_limit:
          account.creditData?.creditLimit ?? account.bankData?.overdraftContractedLimit ?? null,
        currency: account.currencyCode ?? "BRL",
        subtype: account.subtype ?? null,
        is_manual: false,
        open_finance: true,
        external_id: account.id,
        last_sync_at: new Date().toISOString(),
        metadata: { connection_id: connectionId, provider_account_id: account.id },
      };
      const { data: savedAccount, error: findAccountError } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", account.id)
        .maybeSingle();
      if (findAccountError) throw findAccountError;
      const accountWrite = savedAccount
        ? await supabase
            .from("accounts")
            .update(accountPayload)
            .eq("id", savedAccount.id)
            .eq("user_id", userId)
            .select("id")
            .single()
        : await supabase.from("accounts").insert(accountPayload).select("id").single();
      if (accountWrite.error) throw accountWrite.error;
      const accountId = accountWrite.data.id;

      const transactions = await getAllPluggyTransactions(account.id);
      for (const transaction of transactions) {
        const normalized = transactionValues(transaction);
        const { data: existing, error: existingError } = await supabase
          .from("transactions")
          .select("id")
          .eq("user_id", userId)
          .eq("external_id", transaction.id)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) duplicatesSkipped += 1;

        const rawData = transaction as unknown as Json;
        const { data: rawTransaction, error: rawError } = await supabase
          .from("external_transactions")
          .upsert(
            {
              connection_id: connectionId,
              account_id: accountId,
              provider: "pluggy",
              external_id: transaction.id,
              external_account_id: account.id,
              amount: normalized.amount,
              currency: transaction.currencyCode ?? account.currencyCode ?? "BRL",
              description: transaction.description ?? "Movimentação",
              merchant_name: normalized.merchant,
              mcc: transaction.mcc == null ? null : String(transaction.mcc),
              posted_at: transaction.date,
              authorized_at: transaction.createdAt ?? null,
              status: normalized.status,
              raw_data: rawData,
              processed_at: null,
            },
            { onConflict: "provider,external_account_id,external_id" },
          )
          .select("id")
          .single();
        if (rawError) throw rawError;

        const transactionPayload = {
          user_id: userId,
          account_id: accountId,
          external_id: transaction.id,
          external_transaction_id: rawTransaction.id,
          description: transaction.description ?? "Movimentação",
          amount: normalized.amount,
          type: normalized.type,
          category: normalized.category,
          merchant: normalized.merchant,
          occurred_at: transaction.date.slice(0, 10),
          posted_at: transaction.date,
          status: normalized.status,
          record_origin: "open_finance",
        };
        const transactionWrite = existing
          ? await supabase
              .from("transactions")
              .update(transactionPayload)
              .eq("id", existing.id)
              .eq("user_id", userId)
          : await supabase.from("transactions").insert(transactionPayload);
        if (transactionWrite.error) throw transactionWrite.error;
        const { error: processedError } = await supabase
          .from("external_transactions")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", rawTransaction.id);
        if (processedError) throw processedError;
        transactionsImported += 1;
      }

      // Provider balance is authoritative; never add imported transactions again.
      const { error: balanceError } = await supabase
        .from("accounts")
        .update({
          balance: account.balance,
          current_balance: account.balance,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .eq("user_id", userId);
      if (balanceError) throw balanceError;
    }

    const investments = await getAllPluggyInvestments(itemId);
    for (const investment of investments) {
      const normalized = normalizeInvestmentPosition(investment);
      const { data: account } = investment.accountId
        ? await supabase
            .from("accounts")
            .select("id")
            .eq("user_id", userId)
            .eq("external_id", investment.accountId)
            .maybeSingle()
        : { data: null };
      const { data: position, error: positionError } = await supabase
        .from("investment_positions")
        .upsert(
          {
            user_id: userId,
            account_id: account?.id ?? null,
            ticker: normalized.ticker,
            name: normalized.name,
            asset_class: normalized.assetClass,
            quantity: normalized.quantity,
            average_price: normalized.averagePrice,
            current_price: normalized.currentPrice,
            private_product_type: normalized.privateProductType,
            institution: normalized.institution ?? item.connector.name,
            maturity_date: normalized.maturityDate,
            fgc_eligible: normalized.fgcEligible,
            external_id: investment.id,
            source: "open_finance",
            source_connection_id: connectionId,
            reference_date: normalized.referenceDate,
            provider_balance: normalized.marketValue,
            raw_data: investment as unknown as Json,
            last_synced_at: new Date().toISOString(),
            record_origin: "open_finance",
            archived_at: null,
          },
          { onConflict: "user_id,source,external_id" },
        )
        .select("id")
        .single();
      if (positionError) throw positionError;
      investmentsImported += 1;

      let movements: Awaited<ReturnType<typeof getAllPluggyInvestmentTransactions>> = [];
      try {
        movements = await getAllPluggyInvestmentTransactions(investment.id);
      } catch {
        // Nem todo conector habilitado para investimentos oferece movimentações.
      }
      for (const [movementIndex, movement] of movements.entries()) {
        const fees = Object.values(movement.expenses ?? {}).reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0,
        );
        const occurredAt = (movement.tradeDate ?? movement.date).slice(0, 10);
        const externalId =
          movement.id ??
          `${investment.id}:${occurredAt}:${movement.type}:${movement.quantity}:${movement.amount}:${movementIndex}`;
        const movementType = movement.type.toLowerCase();
        const allowed = ["buy", "sell", "tax", "transfer", "interest", "amortization"];
        const { error: movementError } = await supabase.from("investment_transactions").upsert(
          {
            user_id: userId,
            position_id: position.id,
            external_id: externalId,
            source: "open_finance",
            type: allowed.includes(movementType) ? movementType : "other",
            description: movement.description ?? null,
            quantity: movement.quantity ?? 0,
            unit_price: movement.value ?? 0,
            gross_amount: movement.amount ?? 0,
            net_amount: movement.netAmount ?? null,
            fees,
            occurred_at: occurredAt,
            raw_data: movement as unknown as Json,
          },
          { onConflict: "user_id,source,external_id" },
        );
        if (movementError) throw movementError;
        investmentTransactionsImported += 1;
      }
    }

    await supabase
      .from("account_connections")
      .update({
        status: "active",
        consent_status: "authorised",
        last_sync_at: new Date().toISOString(),
        last_successful_sync_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", connectionId)
      .eq("user_id", userId);

    const result = {
      success: true,
      accountsImported: accounts.length,
      transactionsImported,
      duplicatesSkipped,
      investmentsImported,
      investmentTransactionsImported,
    };
    await supabase.from("openfinance_syncs").insert({
      connection_id: connectionId,
      provider: "pluggy",
      status: "completed",
      accounts_imported: accounts.length,
      balances_imported: accounts.length,
      transactions_imported: transactionsImported,
      investments_imported: investmentsImported,
      duplicates_skipped: duplicatesSkipped,
      duration_ms: Date.now() - startedAt,
      errors: [],
    });
    logEvent("info", "openfinance.sync.completed", {
      durationMs: Date.now() - startedAt,
      accountsImported: accounts.length,
      transactionsImported,
      duplicatesSkipped,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    logEvent("error", "openfinance.sync.failed", { durationMs: Date.now() - startedAt });
    await supabase
      .from("account_connections")
      .update({ status: "error", error_message: message, last_error_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("user_id", userId);
    await supabase.from("openfinance_syncs").insert({
      connection_id: connectionId,
      provider: "pluggy",
      status: "failed",
      duration_ms: Date.now() - startedAt,
      errors: [{ message }],
    });
    throw error;
  }
}

export async function revokePluggyConnection(
  supabase: AuthenticatedClient,
  userId: string,
  connectionId: string,
): Promise<void> {
  const { data: connection, error } = await supabase
    .from("account_connections")
    .select("metadata, consent_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  const metadata = connection.metadata as Record<string, unknown> | null;
  const itemId = metadata?.["provider_connection_id"];
  if (typeof itemId === "string") await deletePluggyItem(itemId);
  await supabase
    .from("account_connections")
    .update({ status: "inactive", consent_status: "revoked" })
    .eq("id", connectionId)
    .eq("user_id", userId);
  if (connection.consent_id) {
    await supabase
      .from("openfinance_consents")
      .update({ status: "revoked" })
      .eq("id", connection.consent_id);
  }
}

type PluggyWebhookPayload = {
  event?: string;
  eventId?: string;
  itemId?: string;
  clientUserId?: string;
  transactionIds?: string[];
};

export async function handlePluggyWebhook(payload: unknown): Promise<void> {
  const event = payload as PluggyWebhookPayload;
  if (!event.event || !event.eventId || !event.itemId) {
    throw new Error("Payload de webhook Pluggy inválido.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: previous } = await supabaseAdmin
    .from("provider_webhook_events")
    .select("id")
    .eq("provider", "pluggy")
    .eq("external_event_id", event.eventId)
    .maybeSingle();
  if (previous) return;

  const { data: webhook, error: webhookError } = await supabaseAdmin
    .from("provider_webhook_events")
    .insert({
      provider: "pluggy",
      external_event_id: event.eventId,
      event_type: event.event,
      status: "processing",
    })
    .select("id")
    .single();
  if (webhookError) throw webhookError;

  try {
    const { data: connection } = await supabaseAdmin
      .from("account_connections")
      .select("id, user_id")
      .contains("metadata", { provider_connection_id: event.itemId })
      .maybeSingle();

    // item/created can arrive before onSuccess has persisted the local connection.
    if (connection && (!event.clientUserId || event.clientUserId === connection.user_id)) {
      if (event.event === "item/deleted") {
        await supabaseAdmin
          .from("account_connections")
          .update({ status: "inactive", consent_status: "revoked" })
          .eq("id", connection.id)
          .eq("user_id", connection.user_id);
      } else if (event.event === "item/error") {
        await supabaseAdmin
          .from("account_connections")
          .update({ status: "error", last_error_at: new Date().toISOString() })
          .eq("id", connection.id)
          .eq("user_id", connection.user_id);
      } else if (event.event === "transactions/deleted" && event.transactionIds?.length) {
        await supabaseAdmin
          .from("transactions")
          .delete()
          .eq("user_id", connection.user_id)
          .in("external_id", event.transactionIds);
        await supabaseAdmin
          .from("external_transactions")
          .delete()
          .eq("connection_id", connection.id)
          .in("external_id", event.transactionIds);
      } else if (
        event.event === "item/updated" ||
        event.event === "transactions/created" ||
        event.event === "transactions/updated"
      ) {
        await syncPluggyConnection(
          supabaseAdmin as unknown as AuthenticatedClient,
          connection.user_id,
          connection.id,
        );
      }
    }

    await supabaseAdmin
      .from("provider_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", webhook.id);
  } catch (error) {
    await supabaseAdmin
      .from("provider_webhook_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Falha desconhecida",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhook.id);
    throw error;
  }
}
