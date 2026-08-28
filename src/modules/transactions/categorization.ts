import { CategorizationResult, CategorizationSource, TransactionCategory, Transaction } from './types';
import { createClient } from '@/lib/supabase/server';

interface MerchantRule {
  pattern: RegExp;
  category_id: string;
  subcategory_id?: string;
  priority: number;
}

interface UserRule {
  id: string;
  pattern: RegExp;
  category_id: string;
  subcategory_id?: string;
}

export class CategorizationEngine {
  private supabase = createClient();
  private merchantRules: MerchantRule[] = [];
  private userRulesCache: Map<string, UserRule[]> = new Map();
  private categoryCache: Map<string, TransactionCategory> = new Map();

  async initialize(): Promise<void> {
    await this.loadMerchantRules();
    await this.loadCategories();
  }

  private async loadMerchantRules(): Promise<void> {
    this.merchantRules = [
      { pattern: /uber|99pop|lyft/i, category_id: await this.getCategoryId('expense_transport'), priority: 10 },
      { pattern: /ifood|rappi|uber\s*eats|zé\s*delivery/i, category_id: await this.getCategoryId('expense_food'), priority: 10 },
      { pattern: /netflix|spotify|youtube\s*premium|disney\+|amazon\s*prime/i, category_id: await this.getCategoryId('expense_subscriptions'), priority: 10 },
      { pattern: /shell|ipiranga|petrobras|ale|br\sposto/i, category_id: await this.getCategoryId('expense_transport'), priority: 8 },
      { pattern: /mercado\s*livre|amazon|magazine\s*luiza|americanas|shopee/i, category_id: await this.getCategoryId('expense_shopping'), priority: 8 },
      { pattern: /farm[aá]cia|drogaria|droga\s*raia|pacheco/i, category_id: await this.getCategoryId('expense_health'), priority: 8 },
      { pattern: /supermercado|mercado|atacad[aã]o|extra|p[ãa]o\s*de\s*a[cç]uc[aá]r|carrefour|walmart/i, category_id: await this.getCategoryId('expense_food'), priority: 8 },
      { pattern: /uber|99|taxi|cabify/i, category_id: await this.getCategoryId('expense_transport'), priority: 8 },
      { pattern: /google|apple|microsoft|aws|azure|digitalocean/i, category_id: await this.getCategoryId('expense_subscriptions'), priority: 8 },
      { pattern: /pix\s*(enviado|recebido)|ted|doc|transfer[eê]ncia/i, category_id: await this.getCategoryId('transfer_internal'), priority: 10 },
      { pattern: /dividendo|jcp|rendimento|provento/i, category_id: await this.getCategoryId('investment_dividend'), priority: 10 },
      { pattern: /corretagem|taxa\s*cust[oó]dia|emolumentos/i, category_id: await this.getCategoryId('investment_fee'), priority: 10 },
    ].filter(r => r.category_id) as MerchantRule[];
  }

  private async loadCategories(): Promise<void> {
    const { data } = await this.supabase
      .from('transaction_categories')
      .select('id, code')
      .eq('is_system', true);

    data?.forEach(cat => {
      this.categoryCache.set(cat.code, cat as TransactionCategory);
    });
  }

  private async getCategoryId(code: string): Promise<string | null> {
    const cat = this.categoryCache.get(code);
    return cat?.id || null;
  }

  async categorize(
    transaction: Transaction,
    userId: string
  ): Promise<CategorizationResult> {
    const description = `${transaction.merchant_name || ''} ${transaction.description}`.toLowerCase();

    // 1. MCC-based
    const mccResult = await this.categorizeByMCC(transaction);
    if (mccResult.confidence >= 0.7) return mccResult;

    // 2. Merchant rules
    const merchantResult = this.categorizeByMerchantRules(description);
    if (merchantResult.confidence >= 0.8) return merchantResult;

    // 3. User rules
    const userResult = await this.categorizeByUserRules(userId, description);
    if (userResult.confidence >= 0.9) return userResult;

    // 4. History-based (same merchant)
    const historyResult = await this.categorizeByHistory(userId, transaction.merchant_name);
    if (historyResult.confidence >= 0.75) return historyResult;

    // 5. LLM fallback (low confidence, marked for review)
    const llmResult = await this.categorizeByLLM(transaction);
    if (llmResult.confidence >= 0.5) return llmResult;

    // 6. Default: unclassified
    const unclassifiedId = await this.getCategoryId('other_unclassified');
    return {
      category_id: unclassifiedId,
      subcategory_id: null,
      confidence: 0.1,
      source: 'manual',
      reason: 'No rule matched - requires manual categorization',
    };
  }

  private async categorizeByMCC(transaction: Transaction): Promise<CategorizationResult> {
    if (!transaction.metadata?.mcc) {
      return { category_id: null, subcategory_id: null, confidence: 0, source: 'mcc', reason: 'No MCC' };
    }

    const mcc = transaction.metadata.mcc as string;
    const categoryId = await this.getCategoryId(`mcc_${mcc}`);

    if (categoryId) {
      return {
        category_id: categoryId,
        subcategory_id: null,
        confidence: 0.75,
        source: 'mcc',
        reason: `MCC ${mcc} mapped to category`,
      };
    }

    return { category_id: null, subcategory_id: null, confidence: 0, source: 'mcc', reason: `MCC ${mcc} not mapped` };
  }

  private categorizeByMerchantRules(description: string): CategorizationResult {
    for (const rule of this.merchantRules) {
      if (rule.pattern.test(description)) {
        return {
          category_id: rule.category_id,
          subcategory_id: null,
          confidence: 0.85,
          source: 'rule',
          reason: `Merchant rule matched: ${rule.pattern.source}`,
        };
      }
    }
    return { category_id: null, subcategory_id: null, confidence: 0, source: 'rule', reason: 'No merchant rule matched' };
  }

  private async categorizeByUserRules(userId: string, description: string): Promise<CategorizationResult> {
    let rules = this.userRulesCache.get(userId);

    if (!rules) {
      const { data } = await this.supabase
        .from('user_categorization_rules')
        .select('id, pattern, category_id, subcategory_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      rules = (data || []).map(r => ({
        id: r.id,
        pattern: new RegExp(r.pattern, 'i'),
        category_id: r.category_id,
        subcategory_id: r.subcategory_id,
      }));

      this.userRulesCache.set(userId, rules);
    }

    for (const rule of rules) {
      if (rule.pattern.test(description)) {
        return {
          category_id: rule.category_id,
          subcategory_id: rule.subcategory_id || null,
          confidence: 0.95,
          source: 'user',
          reason: `User rule matched: ${rule.pattern.source}`,
        };
      }
    }

    return { category_id: null, subcategory_id: null, confidence: 0, source: 'user', reason: 'No user rule matched' };
  }

  private async categorizeByHistory(
    userId: string,
    merchantName: string | null
  ): Promise<CategorizationResult> {
    if (!merchantName) {
      return { category_id: null, subcategory_id: null, confidence: 0, source: 'ml', reason: 'No merchant name' };
    }

    const { data } = await this.supabase
      .from('transactions')
      .select('category_id, subcategory_id')
      .eq('user_id', userId)
      .ilike('merchant_name', `%${merchantName}%`)
      .not('category_id', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(10);

    if (!data?.length) {
      return { category_id: null, subcategory_id: null, confidence: 0, source: 'ml', reason: 'No history' };
    }

    const categories = data.map(d => d.category_id).filter(Boolean);
    const mostCommon = this.getMostFrequent(categories);

    if (mostCommon) {
      const count = categories.filter(c => c === mostCommon).length;
      const confidence = Math.min(0.5 + (count / data.length) * 0.3, 0.85);

      return {
        category_id: mostCommon,
        subcategory_id: data.find(d => d.category_id === mostCommon)?.subcategory_id || null,
        confidence,
        source: 'ml',
        reason: `Historical pattern: ${count}/${data.length} transactions`,
      };
    }

    return { category_id: null, subcategory_id: null, confidence: 0, source: 'ml', reason: 'No clear pattern' };
  }

  private async categorizeByLLM(transaction: Transaction): Promise<CategorizationResult> {
    // Placeholder for LLM categorization
    // Will be implemented in Phase 11 (Axionn IA)
    return {
      category_id: null,
      subcategory_id: null,
      confidence: 0,
      source: 'llm',
      reason: 'LLM categorization not yet implemented',
    };
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

  invalidateUserRulesCache(userId: string): void {
    this.userRulesCache.delete(userId);
  }
}

export const categorizationEngine = new CategorizationEngine();