import { supabase } from "@/integrations/supabase/client";
import type { StatementRow } from "@/lib/statement-import";
import type { Transaction } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DbJson, DbTransactionType, requireUserId } from "./common";

export function useTransactions(limit: number | null = 200, showArchived = false) {
  return useQuery({
    queryKey: ["transactions", limit, showArchived],
    queryFn: async ({ signal }): Promise<Transaction[]> => {
      const fetchPage = async (offset: number) => {
        let request = supabase
          .from("transactions")
          .select(
            "id, account_id, description, merchant, category, type, amount, occurred_at, status, is_recurring, archived_at, record_origin, accounts(name)",
          )
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + (limit ?? 500) - 1)
          .abortSignal(signal);
        request = showArchived
          ? request.not("archived_at", "is", null)
          : request.is("archived_at", null);
        const { data, error } = await request;
        if (error) throw error;
        return data ?? [];
      };
      const data = await fetchPage(0);
      if (limit === null) {
        let pageLength = data.length;
        while (pageLength === 500) {
          const next = await fetchPage(data.length);
          data.push(...next);
          pageLength = next.length;
        }
      }
      const { data: overrides, error: overrideError } = await supabase
        .from("transaction_overrides")
        .select("*");
      if (overrideError) throw overrideError;
      const corrections = new Map(
        (overrides ?? []).map((override) => [override.transaction_id, override]),
      );
      return (data ?? []).map((row) => ({
        id: row.id,
        description: corrections.get(row.id)?.description ?? row.description,
        merchant: corrections.get(row.id)?.merchant ?? row.merchant ?? "",
        category: corrections.get(row.id)?.category ?? row.category,
        pending: row.status === "pending",
        status: row.status,
        kind: row.type as DbTransactionType,
        amount: Number(row.amount),
        date: row.occurred_at,
        accountName: row.accounts?.name ?? "—",
        accountId: row.account_id,
        isRecurring: row.is_recurring,
        archivedAt: row.archived_at,
        recordOrigin: row.record_origin as NonNullable<Transaction["recordOrigin"]>,
      }));
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      description: string;
      amount: number;
      type: DbTransactionType;
      category: string;
      merchant?: string;
      accountId?: string | null;
      occurredAt: string;
    }) => {
      const { error } = await supabase.rpc("create_manual_transaction", {
        p_data: {
          account_id: input.accountId,
          description: input.description,
          amount: input.amount,
          type: input.type,
          category: input.category,
          merchant: input.merchant ?? null,
          occurred_at: input.occurredAt,
        } as unknown as DbJson,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
  });
}

export function useImportStatementTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountId: string; rows: StatementRow[] }) => {
      const validRows = input.rows.filter((row) => row.valid);
      let imported = 0;
      for (const row of validRows) {
        const { error } = await supabase.rpc("upsert_transaction_idempotent", {
          p_idempotency_key: row.externalId,
          p_data: {
            account_id: input.accountId,
            description: row.description,
            amount: row.amount,
            type: row.amount >= 0 ? "income" : "expense",
            category: "Outros",
            occurred_at: row.date,
          } as unknown as DbJson,
        });
        if (error) throw error;
        imported += 1;
      }
      return { imported, ignored: input.rows.length - validRows.length };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
  });
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.rpc("edit_transaction", {
        p_id: id,
        p_changes: { category },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      description: string;
      amount: number;
      type: DbTransactionType;
      category: string;
      merchant?: string;
      accountId?: string | null;
      occurredAt: string;
    }) => {
      const { error } = await supabase.rpc("edit_transaction", {
        p_id: input.id,
        p_changes: {
          account_id: input.accountId ?? null,
          description: input.description,
          amount: input.amount,
          type: input.type,
          category: input.category,
          merchant: input.merchant ?? null,
          occurred_at: input.occurredAt,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
  });
}

export type TransactionCategory = {
  id: string;
  label: string;
  kind: "income" | "expense" | "transfer" | string;
  isSystem: boolean;
  archivedAt: string | null;
};

export function useTransactionCategories() {
  return useQuery({
    queryKey: ["transaction-categories"],
    queryFn: async (): Promise<TransactionCategory[]> => {
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("id, label, name, kind, is_system, archived_at")
        .is("archived_at", null)
        .order("kind")
        .order("label");
      if (error) throw error;
      return (data ?? []).map((category) => ({
        id: category.id,
        label: category.name ?? category.label,
        kind: category.kind,
        isSystem: category.is_system,
        archivedAt: category.archived_at,
      }));
    },
  });
}

export function useCreateTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; kind: "income" | "expense" | "transfer" }) => {
      const userId = await requireUserId();
      const label = input.label.trim();
      if (label.length < 2) throw new Error("Informe um nome de categoria válido.");

      const { error } = await supabase.from("transaction_categories").insert({
        user_id: userId,
        code: `custom_${crypto.randomUUID()}`,
        label,
        name: label,
        kind: input.kind,
        is_system: false,
        color: "#64748b",
      });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
        throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transaction-categories"] }),
  });
}

export function useArchiveTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transaction_categories")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .eq("is_system", false);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transaction-categories"] }),
  });
}

export function useUpdateTransactionCategoryDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; label: string }) => {
      const label = input.label.trim();
      if (label.length < 2) throw new Error("Informe um nome de categoria válido.");
      const { error } = await supabase
        .from("transaction_categories")
        .update({ label, name: label })
        .eq("id", input.id)
        .eq("is_system", false);
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
        throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transaction-categories"] }),
  });
}

export function useChangeTransactionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      previousStatus: "pending" | "settled";
      status: "pending" | "settled";
    }) => {
      const userId = await requireUserId();
      // O banco aplica as movimentações de saldo e diário pelos triggers existentes.
      // posted_at é vinculado a occurred_at por um trigger de compatibilidade;
      // alterar a situação não deve mudar a data original do lançamento.
      // O filtro do estado anterior impede confirmar uma versão já alterada em outra sessão.
      const { data, error } = await supabase
        .from("transactions")
        .update({ status: input.status })
        .eq("id", input.id)
        .eq("user_id", userId)
        .eq("status", input.previousStatus)
        .in("record_origin", ["manual", "import"])
        .is("archived_at", null)
        .select("id")
        .single();
      if (error || !data)
        throw new Error("Não foi possível alterar a situação. Atualize a lista e tente novamente.");
    },
    onSuccess: () => {
      for (const key of [
        "transactions",
        "budgets",
        "accounts",
        "wallet-summary",
        "account-reconciliation",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
