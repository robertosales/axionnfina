import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/shared/finance-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type TagStat = {
  tag: string;
  count: number;
  total: number;
};

/** Agrega tags de uma lista de transações (contagem + soma dos valores). */
export function aggregateTags(
  transactions: Pick<Transaction, "tags" | "amount">[],
): TagStat[] {
  const stats = new Map<string, { count: number; total: number }>();
  for (const transaction of transactions) {
    for (const tag of transaction.tags ?? []) {
      const entry = stats.get(tag) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += transaction.amount;
      stats.set(tag, entry);
    }
  }
  return [...stats]
    .map(([tag, entry]) => ({ tag, ...entry }))
    .sort(
      (left, right) => right.count - left.count || left.tag.localeCompare(right.tag, "pt-BR"),
    );
}

/** Renomeia (ou remove, se `to` for null) uma tag em todas as transações. */
export function useBulkRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      from: string;
      to: string | null;
      transactions: Transaction[];
    }) => {
      const targets = input.transactions.filter((t) => (t.tags ?? []).includes(input.from));
      let updated = 0;
      for (const target of targets) {
        const current = target.tags ?? [];
        const next =
          input.to === null
            ? current.filter((tag) => tag !== input.from)
            : Array.from(new Set([...current.filter((tag) => tag !== input.from), input.to]));
        if (next.length === current.length && next.every((tag) => current.includes(tag))) continue;
        const { error } = await supabase.rpc("edit_transaction", {
          p_id: target.id,
          p_changes: { tags: next },
        });
        if (error) throw error;
        updated += 1;
      }
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
