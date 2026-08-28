import { NormalizedTransaction, ExternalTransaction } from './types';
import { createClient } from '@/lib/supabase/server';

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingId?: string;
}

export class DeduplicationEngine {
  private supabase = createClient();

  async checkDuplicate(external: ExternalTransaction): Promise<DeduplicationResult> {
    const { data, error } = await this.supabase
      .from('external_transactions')
      .select('id')
      .eq('provider', external.provider)
      .eq('external_account_id', external.external_account_id)
      .eq('external_id', external.external_id)
      .maybeSingle();

    if (error) {
      throw new Error(`Deduplication check failed: ${error.message}`);
    }

    return {
      isDuplicate: !!data,
      existingId: data?.id,
    };
  }

  async checkDuplicateByContent(
    userId: string,
    normalized: NormalizedTransaction,
    accountId: string,
    windowDays = 3
  ): Promise<DeduplicationResult> {
    const startDate = new Date(normalized.posted_at);
    startDate.setDate(startDate.getDate() - windowDays);

    const endDate = new Date(normalized.posted_at);
    endDate.setDate(endDate.getDate() + windowDays);

    const { data, error } = await this.supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('amount', normalized.amount)
      .eq('currency', normalized.currency)
      .gte('posted_at', startDate.toISOString())
      .lte('posted_at', endDate.toISOString())
      .ilike('description', `%${normalized.description.slice(0, 50)}%`)
      .maybeSingle();

    if (error) {
      throw new Error(`Content deduplication check failed: ${error.message}`);
    }

    return {
      isDuplicate: !!data,
      existingId: data?.id,
    };
  }
}

export const deduplicationEngine = new DeduplicationEngine();