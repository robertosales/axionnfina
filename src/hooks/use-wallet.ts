import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWalletSummary,
  getArchivedAccounts,
  upsertAccount,
  archiveAccount,
  setPrimaryAccount,
  createBalanceSnapshot,
  getAccountBalances,
  getAccountConnections,
  createConnection,
  getCreditCards,
  type WalletSummary,
  type AccountBalance,
  type AccountConnection,
  type CreditCard,
  type AccountType,
} from "@/lib/account-service";

/* ------------------------------------------------------------------ */
/* Wallet Summary                                                       */
/* ------------------------------------------------------------------ */

export function useWalletSummary() {
  return useQuery({
    queryKey: ["wallet-summary"],
    queryFn: getWalletSummary,
    staleTime: 30_000,
  });
}

export function useArchivedAccounts() {
  return useQuery({
    queryKey: ["accounts", "archived"],
    queryFn: getArchivedAccounts,
  });
}

/* ------------------------------------------------------------------ */
/* Account CRUD                                                         */
/* ------------------------------------------------------------------ */

export function useUpsertAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id?: string;
      name?: string;
      institution?: string;
      institution_id?: string;
      type?: AccountType;
      balance?: number;
      available_balance?: number;
      credit_limit?: number;
      currency?: string;
      subtype?: string;
      is_primary?: boolean;
      is_manual?: boolean;
      open_finance?: boolean;
      external_id?: string;
      metadata?: Record<string, unknown>;
    }) => upsertAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => archiveAccount(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useSetPrimaryAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => setPrimaryAccount(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Balance Snapshots                                                    */
/* ------------------------------------------------------------------ */

export function useAccountBalances(accountId: string, limit = 30) {
  return useQuery({
    queryKey: ["account-balances", accountId, limit],
    queryFn: () => getAccountBalances(accountId, limit),
    enabled: !!accountId,
  });
}

export function useCreateBalanceSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      balance,
      availableBalance,
    }: {
      accountId: string;
      balance: number;
      availableBalance?: number;
    }) => createBalanceSnapshot(accountId, balance, availableBalance),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-balances"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Connections                                                          */
/* ------------------------------------------------------------------ */

export function useAccountConnections() {
  return useQuery({
    queryKey: ["account-connections"],
    queryFn: getAccountConnections,
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      institution_id: string;
      consent_id?: string;
      status?: "active" | "inactive" | "error" | "pending";
      external_provider?: string;
      sync_interval_minutes?: number;
      metadata?: Record<string, unknown>;
    }) => createConnection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-connections"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Credit Cards                                                         */
/* ------------------------------------------------------------------ */

export function useCreditCards() {
  return useQuery({
    queryKey: ["credit-cards"],
    queryFn: getCreditCards,
  });
}
