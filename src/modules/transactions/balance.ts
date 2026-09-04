import type { TransactionStatus } from "./types";

export type BalanceTransaction = {
  account_id: string | null;
  amount: number;
  status: TransactionStatus;
  record_origin?: "manual" | "open_finance" | "import" | "system" | null;
};

const POSTED_STATUSES = new Set<TransactionStatus>(["settled"]);

export function transactionBalanceDelta(transaction: BalanceTransaction): number {
  if (
    !transaction.account_id ||
    transaction.record_origin === "open_finance" ||
    !POSTED_STATUSES.has(transaction.status)
  ) {
    return 0;
  }
  return transaction.amount;
}

export function transactionUpdateBalanceDelta(
  previous: BalanceTransaction,
  next: BalanceTransaction,
): number {
  return transactionBalanceDelta(next) - transactionBalanceDelta(previous);
}
