import { createClient } from '@/lib/supabase/server';
import { transactionNormalizer } from './normalizer';
import { deduplicationEngine } from './deduplication';
import { categorizationEngine } from './categorization';
import { ledgerService } from './ledger';
import { NormalizedTransaction, ExternalTransaction, Transaction } from './types';

export interface SyncResult {
  synced: number;
  duplicates: number;
  errors: Array<{ entity: string; code: string; message: string }>;
}

export class TransactionSyncService {
  private supabase = createClient();

  async syncConnection(connectionId: string): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, duplicates: 0, errors: [] };

    try {
      // 1. Create sync record
      const { data: syncRecord } = await this.supabase.rpc('trigger_sync', {
        p_connection_id: connectionId,
      });

      const syncId = syncRecord?.sync_id;
      if (!syncId) throw new Error('Failed to create sync record');

      // 2. Get connection and accounts
      const { data: connection } = await this.supabase
        .from('account_connections')
        .select('*, accounts:accounts(*)')
        .eq('id', connectionId)
        .single();

      if (!connection) throw new Error('Connection not found');

      // 3. Sync each account
      for (const account of connection.accounts || []) {
        try {
          const accountResult = await this.syncAccountTransactions(syncId, connectionId, account.id);
          result.synced += accountResult.synced;
          result.duplicates += accountResult.duplicates;
          result.errors.push(...accountResult.errors);
        } catch (err) {
          result.errors.push({
            entity: 'account',
            code: 'SYNC_ACCOUNT_FAILED',
            message: `Account ${account.id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
        }
      }

      // 4. Update sync record with results
      await this.supabase
        .from('openfinance_syncs')
        .update({
          status: result.errors.length > 0 && result.synced === 0 ? 'failed' : 'completed',
          transactions_imported: result.synced,
          duplicates_skipped: result.duplicates,
          errors: result.errors,
        })
        .eq('id', syncId);

      // 5. Update connection last sync
      await this.supabase
        .from('account_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: result.errors.length === 0 ? new Date().toISOString() : null,
          last_error_at: result.errors.length > 0 ? new Date().toISOString() : null,
          status: result.errors.length > 0 && result.synced === 0 ? 'error' : 'active',
        })
        .eq('id', connectionId);

      return result;
    } catch (err) {
      throw new Error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async syncAccountTransactions(
    syncId: string,
    connectionId: string,
    accountId: string
  ): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, duplicates: 0, errors: [] };

    // In production, this would fetch from the Open Finance provider
    // For now, we process pending external_transactions

    const { data: externalTxns } = await this.supabase
      .from('external_transactions')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('account_id', accountId)
      .is('processed_at', null)
      .order('posted_at', { ascending: true })
      .limit(500);

    if (!externalTxns?.length) return result;

    for (const extTxn of externalTxns) {
      try {
        const processed = await this.processExternalTransaction(extTxn, accountId);
        if (processed === 'duplicate') {
          result.duplicates++;
        } else if (processed === 'created') {
          result.synced++;
        }
      } catch (err) {
        result.errors.push({
          entity: 'transaction',
          code: 'PROCESS_FAILED',
          message: `External txn ${extTxn.id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });

        await this.supabase
          .from('openfinance_sync_errors')
          .insert({
            connection_id: connectionId,
            sync_id: syncId,
            provider: extTxn.provider,
            error_code: 'PROCESS_FAILED',
            message: err instanceof Error ? err.message : 'Unknown error',
            entity: 'transaction',
            provider_error: extTxn.raw_data,
          });
      }

      // Mark as processed
      await this.supabase
        .from('external_transactions')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', extTxn.id);
    }

    return result;
  }

  private async processExternalTransaction(
    extTxn: ExternalTransaction,
    accountId: string
  ): Promise<'created' | 'duplicate'> {
    // 1. Check idempotency (provider-level)
    const dedupResult = await deduplicationEngine.checkDuplicate(extTxn);
    if (dedupResult.isDuplicate) {
      return 'duplicate';
    }

    // 2. Normalize
    const normalized = transactionNormalizer.normalize(extTxn);

    // 3. Check content-based duplicate
    const contentDedup = await deduplicationEngine.checkDuplicateByContent(
      extTxn.connection_id, // This should be user_id, but we'll get it from account
      normalized,
      accountId
    );
    if (contentDedup.isDuplicate) {
      return 'duplicate';
    }

    // 4. Insert external transaction
    const { error: extError } = await this.supabase
      .from('external_transactions')
      .insert({
        id: extTxn.id,
        connection_id: extTxn.connection_id,
        account_id: extTxn.account_id,
        provider: extTxn.provider,
        external_id: extTxn.external_id,
        external_account_id: extTxn.external_account_id,
        amount: extTxn.amount,
        currency: extTxn.currency,
        description: extTxn.description,
        merchant_name: extTxn.merchant_name,
        mcc: extTxn.mcc,
        posted_at: extTxn.posted_at,
        authorized_at: extTxn.authorized_at,
        status: extTxn.status,
        raw_data: extTxn.raw_data,
      });

    if (extError && extError.code !== '23505') { // Ignore unique violation
      throw new Error(`Failed to insert external transaction: ${extError.message}`);
    }

    // 5. Create normalized transaction
    const { data: txnId } = await this.supabase.rpc('create_transaction_from_external', {
      p_external_transaction_id: extTxn.id,
    });

    if (!txnId) {
      throw new Error('Failed to create normalized transaction');
    }

    // 6. Get the created transaction for categorization
    const { data: transaction } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', txnId)
      .single();

    if (transaction) {
      // 7. Categorize
      const categorization = await categorizationEngine.categorize(transaction, transaction.user_id);

      // 8. Update transaction with category
      await this.supabase
        .from('transactions')
        .update({
          category_id: categorization.category_id,
          subcategory_id: categorization.subcategory_id,
        })
        .eq('id', txnId);

      // 9. Log enrichment
      await this.supabase
        .from('transaction_enrichments')
        .insert({
          transaction_id: txnId,
          category_id: categorization.category_id,
          subcategory_id: categorization.subcategory_id,
          confidence: categorization.confidence,
          source: categorization.source,
          reason: categorization.reason,
        });
    }

    return 'created';
  }

  async detectTransfers(userId: string, windowDays = 3): Promise<number> {
    let paired = 0;

    // Find potential transfer pairs: debit in one account, credit in another, same amount, close dates
    const { data: candidates } = await this.supabase.rpc('detect_transfer_candidates', {
      p_user_id: userId,
      p_window_days: windowDays,
    });

    for (const candidate of candidates || []) {
      try {
        await this.supabase.rpc('pair_transfer', {
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