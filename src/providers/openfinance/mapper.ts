/**
 * Open Finance — Mapper de modelos externos para internos.
 *
 * Converte payloads do provider para os tipos internos do Axionn.
 * Nenhuma regra de negócio neste arquivo — apenas transformação de dados.
 */

import type {
  AccountType,
  ExternalAccount,
  ExternalBalance,
  ExternalCreditCard,
  ExternalInvestment,
  ExternalTransaction,
  TransactionType,
} from "./types";

/* ------------------------------------------------------------------ */
/* Pluggy Types (raw API responses)                                    */
/* ------------------------------------------------------------------ */

type PluggyAccount = {
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

type PluggyBalance = {
  accountId: string;
  amount: number;
  currency: string;
  date: string;
  type: string;
};

type PluggyTransaction = {
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
};

type PluggyInvestment = {
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
};

/* ------------------------------------------------------------------ */
/* Account Mapper                                                       */
/* ------------------------------------------------------------------ */

const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  CHECKING: "checking",
  SAVINGS: "savings",
  CREDIT_CARD: "credit_card",
  INVESTMENT: "investment",
  LOAN: "other",
  BILL: "other",
  WALLET: "payment_account",
  OTHER: "other",
};

export function mapPluggyAccount(account: PluggyAccount): ExternalAccount {
  return {
    id: account.id,
    connection_id: account.connectorId,
    institution_id: account.connectorId,
    external_id: account.id,
    name: account.name,
    type: ACCOUNT_TYPE_MAP[account.type] ?? "other",
    subtype: account.subtype,
    currency: account.currencyCode ?? "BRL",
    status: account.status,
    is_manual: false,
    is_primary: false,
    current_balance: account.balance ?? 0,
    available_balance: null,
    credit_limit: null,
    last_synced_at: account.updatedAt ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Balance Mapper                                                       */
/* ------------------------------------------------------------------ */

export function mapPluggyBalance(balance: PluggyBalance): ExternalBalance {
  return {
    account_id: balance.accountId,
    current: balance.amount ?? 0,
    available: null,
    currency: balance.currency ?? "BRL",
    last_updated: balance.date ?? new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Transaction Mapper                                                   */
/* ------------------------------------------------------------------ */

const TRANSACTION_TYPE_MAP: Record<string, TransactionType> = {
  DEBIT: "expense",
  CREDIT: "income",
  TRANSFER: "transfer",
  FEE: "expense",
  PAYMENT: "expense",
  RECEIVED: "income",
  WITHDRAWAL: "expense",
  DEPOSIT: "income",
};

export function mapPluggyTransaction(tx: PluggyTransaction): ExternalTransaction {
  return {
    id: tx.id,
    account_id: tx.accountId,
    description: tx.description ?? "Transação",
    amount: tx.amount ?? 0,
    type: TRANSACTION_TYPE_MAP[tx.type?.toUpperCase()] ?? "expense",
    category: tx.category,
    merchant: tx.merchant,
    mcc: tx.mcc ? String(tx.mcc) : null,
    method: null,
    status: tx.status ?? "POSTED",
    occurred_at: tx.date ?? new Date().toISOString(),
    booked_at: tx.createdAt ?? null,
    balance_after: tx.balance ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Credit Card Mapper                                                   */
/* ------------------------------------------------------------------ */

export function mapPluggyCreditCard(card: {
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
}): ExternalCreditCard {
  return {
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
  };
}

/* ------------------------------------------------------------------ */
/* Investment Mapper                                                    */
/* ------------------------------------------------------------------ */

export function mapPluggyInvestment(inv: PluggyInvestment): ExternalInvestment {
  return {
    id: inv.id,
    account_id: inv.accountId,
    ticker: inv.ticker ?? "",
    name: inv.name ?? "",
    asset_class: inv.type ?? "stock",
    quantity: inv.quantity ?? 0,
    average_price: inv.price ?? 0,
    current_price: inv.price ?? 0,
    market_value: inv.balance ?? 0,
    profit_loss: inv.netValue ? inv.netValue - inv.balance : 0,
    profit_loss_percentage: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Bulk Mappers                                                         */
/* ------------------------------------------------------------------ */

export function mapPluggyAccounts(accounts: PluggyAccount[]): ExternalAccount[] {
  return accounts.map(mapPluggyAccount);
}

export function mapPluggyBalances(balances: PluggyBalance[]): ExternalBalance[] {
  return balances.map(mapPluggyBalance);
}

export function mapPluggyTransactions(transactions: PluggyTransaction[]): ExternalTransaction[] {
  return transactions.map(mapPluggyTransaction);
}

export function mapPluggyInvestments(investments: PluggyInvestment[]): ExternalInvestment[] {
  return investments.map(mapPluggyInvestment);
}
