import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Connection Hooks                                                     */
/* ------------------------------------------------------------------ */

export function useConnections() {
  return useQuery({
    queryKey: ["account-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_connections")
        .select("*, institutions(name, logo_color)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConnection(id: string) {
  return useQuery({
    queryKey: ["account-connection", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_connections")
        .select("*, institutions(name, logo_color)")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

/* ------------------------------------------------------------------ */
/* Sync Hooks                                                           */
/* ------------------------------------------------------------------ */

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.rpc("trigger_sync", {
        p_connection_id: connectionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-connections"] });
    },
  });
}

export function useSyncHistory(connectionId: string, limit = 20) {
  return useQuery({
    queryKey: ["sync-history", connectionId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sync_history", {
        p_connection_id: connectionId,
        p_limit: limit,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!connectionId,
  });
}

export function useSyncErrors(connectionId: string, limit = 50) {
  return useQuery({
    queryKey: ["sync-errors", connectionId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sync_errors", {
        p_connection_id: connectionId,
        p_limit: limit,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!connectionId,
  });
}

/* ------------------------------------------------------------------ */
/* Revoke Connection                                                    */
/* ------------------------------------------------------------------ */

export function useRevokeConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("account_connections")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-connections"] });
    },
  });
}
