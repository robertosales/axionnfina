import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  SecurityEvent,
  Device,
  SessionMetadata,
} from "@/lib/security-risk";

/* ------------------------------------------------------------------ */
/* Security Events                                                      */
/* ------------------------------------------------------------------ */

export function useSecurityEvents(limit = 20) {
  return useQuery({
    queryKey: ["security-events", limit],
    queryFn: async (): Promise<SecurityEvent[]> => {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as SecurityEvent[]) ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Devices                                                              */
/* ------------------------------------------------------------------ */

export function useDevices() {
  return useQuery({
    queryKey: ["user-devices"],
    queryFn: async (): Promise<Device[]> => {
      const { data, error } = await supabase
        .from("user_devices")
        .select("*")
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      return (data as Device[]) ?? [];
    },
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data, error } = await supabase.rpc("revoke_device", {
        p_device_id: deviceId,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-devices"] });
      qc.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                             */
/* ------------------------------------------------------------------ */

export function useSessions() {
  return useQuery({
    queryKey: ["user-sessions"],
    queryFn: async (): Promise<SessionMetadata[]> => {
      const { data, error } = await supabase
        .from("user_sessions_metadata")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (error) throw error;
      return (data as SessionMetadata[]) ?? [];
    },
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("revoke_all_sessions");
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Security Summary                                                     */
/* ------------------------------------------------------------------ */

export type SecuritySummary = {
  total_events: number;
  recent_events: Array<{
    id: string;
    event_type: string;
    severity: string;
    ip_address: string | null;
    country: string | null;
    created_at: string;
  }>;
  active_devices: number;
  active_sessions: number;
  failed_logins_24h: number;
  suspicious_count: number;
};

export function useSecuritySummary() {
  return useQuery({
    queryKey: ["security-summary"],
    queryFn: async (): Promise<SecuritySummary> => {
      const { data, error } = await supabase.rpc("get_security_summary");
      if (error) throw error;
      return data as SecuritySummary;
    },
  });
}
