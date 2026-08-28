export type CategorizationSource =
  | 'mcc'
  | 'rule'
  | 'user'
  | 'ml'
  | 'llm'
  | 'manual';

export type TransactionStatus =
  | 'pending'
  | 'settled'
  | 'cancelled'
  | 'failed'
  | 'reversed';

export type LedgerEntryType = 'debit' | 'credit';

export interface ExternalTransaction {
  id: string;
  connection_id: string;
  account_id: string;
  provider: string;
  external_id: string;
  external_account_id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  mcc: string | null;
  posted_at: string;
  authorized_at: string | null;
  status: TransactionStatus;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  external_transaction_id: string | null;
  amount: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  status: TransactionStatus;
  posted_at: string;
  authorized_at: string | null;
  is_recurring: boolean;
  is_transfer: boolean;
  transfer_pair_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TransactionCategory {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export interface TransactionTag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TransactionEnrichment {
  id: string;
  transaction_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  confidence: number;
  source: CategorizationSource;
  model_version: string | null;
  reason: string | null;
  applied_by: string | null;
  created_at: string;
}

export interface TransactionPair {
  id: string;
  user_id: string;
  debit_transaction_id: string;
  credit_transaction_id: string;
  amount: number;
  currency: string;
  matched_at: string;
  confidence: number;
  is_manual: boolean;
}

export interface LedgerAccount {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subtype: string | null;
  parent_id: string | null;
  account_id: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  source: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  ledger_account_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  currency: string;
  description: string | null;
  sort_order: number;
}

export interface NormalizedTransaction {
  amount: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  posted_at: Date;
  authorized_at: Date | null;
  status: TransactionStatus;
  mcc: string | null;
  raw_data: Record<string, unknown>;
}

export interface CategorizationResult {
  category_id: string | null;
  subcategory_id: string | null;
  confidence: number;
  source: CategorizationSource;
  reason: string;
}

export interface JournalEntryInput {
  entry_date: Date;
  description: string;
  lines: JournalLineInput[];
  reference_type?: string;
  reference_id?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface JournalLineInput {
  ledger_account_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  currency?: string;
  description?: string;
  sort_order?: number;
}

export interface TransactionSummary {
  period: { start: string; end: string };
  totals: {
    income: number;
    expense: number;
    net: number;
    count: number;
  };
  by_category: Array<{
    category_id: string;
    category_code: string;
    category_name: string;
    parent_code: string | null;
    total: number;
    count: number;
  }>;
  by_account: Array<{
    account_id: string;
    account_name: string;
    institution: string;
    total: number;
    count: number;
  }>;
}

export interface LedgerBalances {
  assets: Array<{ id: string; code: string; name: string; subtype: string; balance: number }>;
  liabilities: Array<{ id: string; code: string; name: string; subtype: string; balance: number }>;
  equity: Array<{ id: string; code: string; name: string; balance: number }>;
  revenue: Array<{ id: string; code: string; name: string; subtype: string; balance: number }>;
  expenses: Array<{ id: string; code: string; name: string; subtype: string; balance: number }>;
}