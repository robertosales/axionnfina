/**
 * Transaction Application Layer - Casos de uso de transações
 *
 * Refatorado para usar injeção de dependência.
 * O client Supabase é passado como parâmetro, não instanciado internamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedTransaction, CategorizationResult } from "@/modules/transactions/types";
import { safeIlikePattern } from "@/lib/query-sanitize";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingId?: string;
}

export interface TransactionServiceConfig {
  supabase: SupabaseClient;
}

/* ------------------------------------------------------------------ */
/* Transaction Service                                                  */
/* ------------------------------------------------------------------ */

export class TransactionService {
  constructor(private config: TransactionServiceConfig) {}

  get supabase() {
    return this.config.supabase;
  }

  /**
   * Verifica se uma transação externa já existe (dedup por ID externo)
   */
  async checkDuplicate(external: {
    provider: string;
    external_id: string;
    external_account_id: string;
  }): Promise<DeduplicationResult> {
    const { data, error } = await this.supabase
      .from("external_transactions")
      .select("id")
      .eq("provider", external.provider)
      .eq("external_account_id", external.external_account_id)
      .eq("external_id", external.external_id)
      .maybeSingle();

    if (error) {
      throw new Error(`Deduplication check failed: ${error.message}`);
    }

    return data ? { isDuplicate: true, existingId: data.id } : { isDuplicate: false };
  }

  /**
   * Verifica duplicidade por conteúdo (mesmo valor, descrição similar, janela de tempo)
   */
  async checkDuplicateByContent(
    userId: string,
    normalized: NormalizedTransaction,
    accountId: string,
    windowDays = 3,
  ): Promise<DeduplicationResult> {
    const startDate = new Date(normalized.posted_at);
    startDate.setDate(startDate.getDate() - windowDays);

    const endDate = new Date(normalized.posted_at);
    endDate.setDate(endDate.getDate() + windowDays);

    const { data, error } = await this.supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("amount", normalized.amount)
      .eq("currency", normalized.currency)
      .gte("posted_at", startDate.toISOString())
      .lte("posted_at", endDate.toISOString())
      .ilike("description", safeIlikePattern(normalized.description))
      .maybeSingle();

    if (error) {
      throw new Error(`Content deduplication check failed: ${error.message}`);
    }

    return data ? { isDuplicate: true, existingId: data.id } : { isDuplicate: false };
  }

  /**
   * Categoriza transação por histórico do merchant
   */
  async categorizeByHistory(
    userId: string,
    merchantName: string,
  ): Promise<CategorizationResult> {
    if (!merchantName) {
      return {
        category_id: null,
        subcategory_id: null,
        confidence: 0,
        source: "ml",
        reason: "No merchant name",
      };
    }

    const { data } = await this.supabase
      .from("transactions")
      .select("category_id, subcategory_id")
      .eq("user_id", userId)
      .ilike("merchant_name", safeIlikePattern(merchantName))
      .not("category_id", "is", null)
      .order("posted_at", { ascending: false })
      .limit(10);

    if (!data?.length) {
      return {
        category_id: null,
        subcategory_id: null,
        confidence: 0,
        source: "ml",
        reason: "No history",
      };
    }

    const categories = data.map((d) => d.category_id).filter(Boolean);
    const mostCommon = this.getMostFrequent(categories);

    if (mostCommon) {
      const count = categories.filter((c) => c === mostCommon).length;
      const confidence = Math.min(0.5 + (count / data.length) * 0.3, 0.85);

      return {
        category_id: mostCommon,
        subcategory_id: data.find((d) => d.category_id === mostCommon)?.subcategory_id || null,
        confidence,
        source: "ml",
        reason: `Historical pattern: ${count}/${data.length} transactions`,
      };
    }

    return {
      category_id: null,
      subcategory_id: null,
      confidence: 0,
      source: "ml",
      reason: "No clear pattern",
    };
  }

  /**
   * Busca memórias do agente por texto
   */
  async searchAgentMemories(userId: string, query: string, limit = 5) {
    const { data, error } = await this.supabase
      .from("agent_memories")
      .select("content, memory_type, importance")
      .eq("user_id", userId)
      .ilike("content", safeIlikePattern(query))
      .order("importance", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }

  private getMostFrequent<T>(arr: T[]): T | null {
    if (!arr.length) return null;
    const counts = new Map<T, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    let maxItem: T | null = null;
    let maxCount = 0;
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxItem = item;
      }
    }
    return maxItem;
  }
}

/**
 * Factory para criar TransactionService com client Supabase
 */
export function createTransactionService(supabase: SupabaseClient): TransactionService {
  return new TransactionService({ supabase });
}
