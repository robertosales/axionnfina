import type { FinancialNotification } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireUserId, rowStr, untypedDb, type DbRow } from "./common";

function toNotification(row: DbRow): FinancialNotification {
  const base = {
    id: rowStr(row, "id"),
    type: rowStr(row, "type", "insight") as FinancialNotification["type"],
    title: rowStr(row, "title"),
    message: rowStr(row, "message"),
    read: row["read"] === true,
    createdAt: rowStr(row, "created_at"),
  };
  const actionUrl = row["action_url"];
  return typeof actionUrl === "string" ? { ...base, actionUrl } : base;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<FinancialNotification[]> => {
      try {
        const userId = await requireUserId();
        const { data, error } = await untypedDb()
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return [];
        return ((data ?? []) as DbRow[]).map(toNotification);
      } catch {
        return [];
      }
    },
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async (): Promise<number> => {
      try {
        const userId = await requireUserId();
        const { count, error } = await untypedDb()
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("read", false);
        if (error) return 0;
        return typeof count === "number" ? count : 0;
      } catch {
        return 0;
      }
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedDb().from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const userId = await requireUserId();
      const { error } = await untypedDb()
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useUpsertNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: FinancialNotification["type"];
      title: string;
      message: string;
      actionUrl?: string;
    }) => {
      const userId = await requireUserId();
      const { error } = await untypedDb().from("notifications").insert({
        user_id: userId,
        type: input.type,
        title: input.title,
        message: input.message,
        read: false,
        action_url: input.actionUrl ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}
