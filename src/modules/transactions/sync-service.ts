import { createClient } from "@/lib/supabase/server";
import { transactionNormalizer } from "./normalizer";
import { deduplicationEngine } from "./deduplication";
import { categorizationEngine } from "./categorization";
import { ledgerService } from "./ledger";
import { NormalizedTransaction, ExternalTransaction, Transaction } from "./types";
import type { Database, Json } from "@/integrations/supabase/types";

type ExternalTransactionRow = Database["public"]["Tables"]["external_transactions"]["Row"];

export interface SyncResult {
  synced: number;
  duplicates: number;
  errors: Array<{ entity: string; code: string; message: string }>;
}

export class TransactionSyncService {
  private supabase = createClient();

  async syncConnection(connectionId: string, userId: string): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, duplicates: 0, errors: [] };

    try {
      // 1. Validate ownership before using the privileged server client.
      const { data: connection } = await this.supabase
        .from("account_connections")
        .select("id, user_id, external_provider")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .single();

      if (!connection) throw new Error("Connection not found");

      // 2. Create an observable sync record.
      const { data: syncRecord, error: syncError } = await this.supabase
        .from("openfinance_syncs")
        .insert({
          connection_id: connectionId,
          provider: connection.external_provider,
          status: "running",
        })
        .select("id")
        .single();
      if (syncError || !syncRecord) throw new Error("Failed to create sync record");
      const syncId = syncRecord.id;

      const { data: accounts, error: accountsError } = await this.supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .contains("metadata", { connection_id: connectionId });
      if (accountsError) throw accountsError;

      // 3. Sync each account
      for (const account of accounts || []) {
        try {
          const accountResult = await this.syncAccountTransactions(
            syncId,
            connectionId,
            account.id,
            userId,
          );
          result.synced += accountResult.synced;
          result.duplicates += accountResult.duplicates;
          result.errors.push(...accountResult.errors);
        } catch (err) {
          result.errors.push({
            entity: "account",
            code: "SYNC_ACCOUNT_FAILED",
            message: `Account ${account.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
      }

      // 4. Update sync record with results
      await this.supabase
        .from("openfinance_syncs")
        .update({
          status: result.errors.length > 0 && result.synced === 0 ? "failed" : "completed",
          transactions_imported: result.synced,
          duplicates_skipped: result.duplicates,
          errors: result.errors,
        })
        .eq("id", syncId);

      // 5. Update connection last sync
      await this.supabase
        .from("account_connections")
        .update({
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: result.errors.length === 0 ? new Date().toISOString() : null,
          last_error_at: result.errors.length > 0 ? new Date().toISOString() : null,
          status: result.errors.length > 0 && result.synced === 0 ? "error" : "active",
        })
        .eq("id", connectionId);

      return result;
    } catch (err) {
      throw new Error(`Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async syncAccountTransactions(
    syncId: string,
    connectionId: string,
    accountId: string,
    userId: string,
  ): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, duplicates: 0, errors: [] };

    // In production, this would fetch from the Open Finance provider
    // For now, we process pending external_transactions

    const { data: externalTxns } = await this.supabase
      .from("external_transactions")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("account_id", accountId)
      .is("processed_at", null)
      .order("posted_at", { ascending: true })
      .limit(500);

    if (!externalTxns?.length) return result;

    for (const extTxn of externalTxns) {
      try {
        const processed = await this.processExternalTransaction(extTxn, accountId, userId);
        if (processed === "duplicate") {
          result.duplicates++;
        } else if (processed === "created") {
          result.synced++;
        }
      } catch (err) {
        result.errors.push({
          entity: "transaction",
          code: "PROCESS_FAILED",
          message: `External txn ${extTxn.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
        });

        await this.supabase.from("openfinance_sync_errors").insert({
          connection_id: connectionId,
          sync_id: syncId,
          provider: extTxn.provider,
          error_code: "PROCESS_FAILED",
          message: err instanceof Error ? err.message : "Unknown error",
          entity: "transaction",
          provider_error: JSON.stringify(extTxn.raw_data),
        });
        continue;
      }

      // Mark only successful or intentionally deduplicated events as processed.
      await this.supabase
        .from("external_transactions")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", extTxn.id);
    }

    return result;
  }

  private async processExternalTransaction(
    extTxn: ExternalTransactionRow,
    accountId: string,
    userId: string,
  ): Promise<"created" | "duplicate"> {
    // The raw event already exists in external_transactions. Idempotency here
    // means checking whether it has already produced a normalized transaction.
    const { data: existing } = await this.supabase
      .from("transactions")
      .select("id")
      .eq("external_transaction_id", extTxn.id)
      .maybeSingle();
    if (existing) {
      return "duplicate";
    }

    const rawData =
      extTxn.raw_data && typeof extTxn.raw_data === "object" && !Array.isArray(extTxn.raw_data)
        ? (extTxn.raw_data as Record<string, unknown>)
        : {};
    const domainExternal: ExternalTransaction = { ...extTxn, raw_data: rawData };

    // 2. Normalize
    const normalized = transactionNormalizer.normalize(domainExternal);

    // 3. Check content-based duplicate
    const contentDedup = await deduplicationEngine.checkDuplicateByContent(
      userId,
      normalized,
      accountId,
    );
    if (contentDedup.isDuplicate) {
      return "duplicate";
    }

    // 4. Create the normalized transaction. The server client is privileged,
    // so user_id is always the ownership value validated at method entry.
    const { data: created, error: createError } = await this.supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: accountId,
        external_transaction_id: extTxn.id,
        amount: normalized.amount,
        currency: normalized.currency,
        description: normalized.description,
        merchant_name: normalized.merchant_name,
        status: normalized.status,
        posted_at: normalized.posted_at.toISOString(),
        authorized_at: normalized.authorized_at?.toISOString() ?? null,
        metadata: { mcc: normalized.mcc, raw_data: normalized.raw_data } as Json,
      })
      .select("*")
      .single();
    if (createError || !created)
      throw new Error(createError?.message ?? "Failed to create normalized transaction");
    const txnId = created.id;

    // 6. Get the created transaction for categorization
    if (created.account_id) {
      const transaction: Transaction = {
        id: created.id,
        user_id: created.user_id,
        account_id: created.account_id,
        external_transaction_id: created.external_transaction_id,
        amount: created.amount,
        currency: created.currency,
        description: created.description,
        merchant_name: created.merchant_name,
        category_id: created.category_id,
        subcategory_id: created.subcategory_id,
        status: created.status,
        posted_at: created.posted_at ?? created.occurred_at,
        authorized_at: created.authorized_at,
        is_recurring: created.is_recurring,
        is_transfer: created.is_transfer,
        transfer_pair_id: created.transfer_pair_id,
        metadata:
          created.metadata &&
          typeof created.metadata === "object" &&
          !Array.isArray(created.metadata)
            ? (created.metadata as Record<string, unknown>)
            : {},
        created_at: created.created_at,
        updated_at: created.updated_at,
      };
      // 7. Categorize
      const categorization = await categorizationEngine.categorize(
        transaction,
        transaction.user_id,
      );

      // 8. Update transaction with category
      await this.supabase
        .from("transactions")
        .update({
          category_id: categorization.category_id,
          subcategory_id: categorization.subcategory_id,
        })
        .eq("id", txnId);

      // 9. Log enrichment
      await this.supabase.from("transaction_enrichments").insert({
        transaction_id: txnId,
        category_id: categorization.category_id,
        subcategory_id: categorization.subcategory_id,
        confidence: categorization.confidence,
        source: categorization.source,
        reason: categorization.reason,
      });
    }

    return "created";
  }

  async detectTransfers(userId: string, windowDays = 3): Promise<number> {
    let paired = 0;

    // Find potential transfer pairs: debit in one account, credit in another, same amount, close dates
    const { data: candidates } = await this.supabase.rpc("detect_transfer_candidates", {
      p_user_id: userId,
      p_window_days: windowDays,
    });

    const transferCandidates = Array.isArray(candidates)
      ? (candidates as Array<{ debit_id: string; credit_id: string }>)
      : [];
    for (const candidate of transferCandidates) {
      try {
        await this.supabase.rpc("pair_transfer", {
          p_debit_transaction_id: candidate.debit_id,
          p_credit_transaction_id: candidate.credit_id,
          p_is_manual: false,
        });
        paired++;
      } catch {
        // Ignore pairing errors
      }
    }

    return paired;
  }
}

export const transactionSyncService = new TransactionSyncService();
