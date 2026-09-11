import { supabase } from "@/integrations/supabase/client";
import { upsertAccount } from "@/lib/account-service";
import { syncConnection } from "@/lib/pluggy.functions";
import type { Account, AccountType } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DbAccountType, dbToUiAccountType, requireUserId, uiToDbAccountType } from "./common";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select(
          "id, name, institution, type, balance, open_finance, last_sync_at, branch, account_number, metadata, record_origin",
        )
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        institution: row.institution,
        name: row.name,
        type: dbToUiAccountType[row.type as DbAccountType],
        balance: Number(row.balance),
        lastSyncedAt: row.last_sync_at,
        connectionId:
          row.metadata &&
          typeof row.metadata === "object" &&
          !Array.isArray(row.metadata) &&
          typeof row.metadata["connection_id"] === "string"
            ? row.metadata["connection_id"]
            : null,
        recordOrigin: row.record_origin as NonNullable<Account["recordOrigin"]>,
        openFinance: row.open_finance,
        branch: row.branch ?? "",
        accountNumber: row.account_number ?? "",
      }));
    },
  });
}

export function useUpsertAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      institution: string;
      name: string;
      type: AccountType;
      balance: number;
      branch?: string;
      accountNumber?: string;
      openFinance?: boolean;
    }) => {
      await requireUserId();
      return upsertAccount({
        ...(input.id ? { id: input.id } : {}),
        institution: input.institution,
        name: input.name,
        type: uiToDbAccountType[input.type],
        balance: input.balance,
        open_finance: input.openFinance ?? false,
        branch: input.branch?.trim() || "",
        account_number: input.accountNumber?.trim() || "",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-card-options"] });
    },
  });
}

export function useSyncAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await requireUserId();
      const { data, error } = await supabase
        .from("accounts")
        .select("metadata, open_finance")
        .eq("id", accountId)
        .single();
      if (error) throw error;
      const metadata = data.metadata;
      const connectionId =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? metadata["connection_id"]
          : null;
      if (!data.open_finance || typeof connectionId !== "string")
        throw new Error("Conexão não disponível");
      return syncConnection({ data: { connectionId } });
    },
    onSuccess: () => {
      for (const key of [
        "accounts",
        "wallet-summary",
        "account-connections",
        "transactions",
        "investments",
      ])
        void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}

export function useOpenFinanceInstitutions() {
  return useQuery({
    queryKey: ["openfinance-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, short_name, code, logo_color")
        .eq("openfinance_participant", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOpenFinanceConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { institutionId: string; scopes: string[] }) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("openfinance_consents")
        .insert({
          user_id: userId,
          institution_id: input.institutionId,
          scopes: input.scopes,
          status: "authorised",
          consent_id: `pending-provider-${crypto.randomUUID()}`,
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export const useInstitutions = useOpenFinanceInstitutions;
