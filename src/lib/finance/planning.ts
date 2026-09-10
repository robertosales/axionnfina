import { supabase } from "@/integrations/supabase/client";
import type { BudgetItem, Goal } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { monthStart, requireUserId } from "./common";
import { useTransactions } from "./transactions";

export function useBudgets(showArchived = false) {
  const transactions = useTransactions(null);

  const query = useQuery({
    queryKey: ["budgets", monthStart(), showArchived],
    queryFn: async () => {
      let request = supabase
        .from("budgets")
        .select("id, category, planned, month, archived_at, record_origin")
        .eq("month", monthStart())
        .order("category", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const month = monthStart().slice(0, 7);
  const items: BudgetItem[] = (query.data ?? []).map((row) => {
    const spent = (transactions.data ?? [])
      .filter(
        (tx) =>
          tx.category === row.category &&
          tx.date.startsWith(month) &&
          tx.kind === "expense" &&
          !tx.pending &&
          tx.amount < 0,
      )
      .reduce((total, tx) => total + Math.abs(tx.amount), 0);
    return {
      id: row.id,
      category: row.category,
      planned: Number(row.planned),
      spent,
      archivedAt: row.archived_at,
      recordOrigin: row.record_origin as NonNullable<BudgetItem["recordOrigin"]>,
    };
  });

  return {
    ...query,
    items,
    isLoading: query.isLoading || transactions.isLoading,
    isError: query.isError || transactions.isError,
    refetch: () => Promise.all([query.refetch(), transactions.refetch()]),
  };
}

export function useGoals(showArchived = false) {
  return useQuery({
    queryKey: ["goals", showArchived],
    queryFn: async (): Promise<Goal[]> => {
      let request = supabase
        .from("goals")
        .select("id, title, target_amount, current_amount, deadline, archived_at, record_origin")
        .order("created_at", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => {
        const target = Number(row.target_amount);
        const current = Number(row.current_amount);
        const deadline = row.deadline ?? "";
        const months = deadline
          ? Math.max(
              1,
              Math.round((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)),
            )
          : 12;
        return {
          id: row.id,
          name: row.title,
          target,
          current,
          dueDate: deadline,
          monthlySuggestion: Math.max(0, Math.round((target - current) / months)),
          archivedAt: row.archived_at,
          recordOrigin: row.record_origin as NonNullable<Goal["recordOrigin"]>,
        };
      });
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; category: string; planned: number }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        category: input.category,
        planned: input.planned,
        month: monthStart(),
      };
      const { error } = input.id
        ? await supabase.from("budgets").update(payload).eq("id", input.id)
        : await supabase.from("budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      targetAmount: number;
      currentAmount: number;
      deadline: string | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        title: input.title,
        target_amount: input.targetAmount,
        current_amount: input.currentAmount,
        deadline: input.deadline,
      };
      const { error } = input.id
        ? await supabase.from("goals").update(payload).eq("id", input.id)
        : await supabase.from("goals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}
