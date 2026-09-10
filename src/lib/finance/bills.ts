import { supabase } from "@/integrations/supabase/client";
import type { BillStatus } from "@/shared/domain";
import type { UpcomingBill } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireUserId } from "./common";

export const statusToUi = {
  pending: "PENDING",
  paid: "SCHEDULED",
  overdue: "OVERDUE",
  canceled: "PENDING",
} as const satisfies Record<BillStatus, UpcomingBill["status"]>;

export type Payable = UpcomingBill & { category: string; scheduled: boolean; dbStatus: BillStatus };

export function usePayables(showArchived = false) {
  return useQuery({
    queryKey: ["payables", showArchived],
    queryFn: async (): Promise<Payable[]> => {
      let request = supabase
        .from("payables")
        .select(
          "id, description, amount, due_date, status, category, scheduled_for, archived_at, record_origin",
        )
        .order("due_date", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      return (data ?? []).map((row) => {
        const status = row.status as BillStatus;
        const overdue = status === "pending" && row.due_date < today;
        return {
          id: row.id,
          name: row.description,
          amount: Number(row.amount),
          dueDate: row.due_date,
          status: overdue ? "OVERDUE" : row.scheduled_for ? "SCHEDULED" : statusToUi[status],
          category: row.category,
          scheduled: Boolean(row.scheduled_for),
          dbStatus: status,
          archivedAt: row.archived_at,
          recordOrigin: row.record_origin as NonNullable<Payable["recordOrigin"]>,
        };
      });
    },
  });
}

export function useReceivables(showArchived = false) {
  return useQuery({
    queryKey: ["receivables", showArchived],
    queryFn: async () => {
      let request = supabase
        .from("receivables")
        .select("id, description, amount, due_date, status, payer, archived_at, record_origin")
        .order("due_date", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        description: row.description,
        amount: Number(row.amount),
        dueDate: row.due_date,
        status: row.status as BillStatus,
        payer: row.payer,
        archivedAt: row.archived_at,
        recordOrigin: row.record_origin,
      }));
    },
  });
}

export function useUpsertPayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      description: string;
      amount: number;
      dueDate: string;
      category?: string;
      barcode?: string | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        category: input.category ?? "Outros",
        barcode: input.barcode ?? null,
      };
      const { error } = input.id
        ? await supabase.from("payables").update(payload).eq("id", input.id)
        : await supabase.from("payables").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payables"] }),
  });
}

export function useSettlePayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payables").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payables"] }),
  });
}

export function useUpsertReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      description: string;
      amount: number;
      dueDate: string;
      payer: string;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        payer: input.payer,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("receivables").update(payload).eq("id", input.id)
        : await supabase.from("receivables").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["receivables"] }),
  });
}
