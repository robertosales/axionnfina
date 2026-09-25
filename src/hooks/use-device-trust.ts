import { useState, useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";

export type DeviceItem = {
  id: string;
  device_name: string;
  is_trusted: boolean;
  os: string | null;
  browser: string | null;
  last_seen_at: string;
};

export function useDeviceTrust() {
  const toggleTrust = useCallback(async (deviceId: string, currentTrust: boolean) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from("user_devices")
        .update({ is_trusted: !currentTrust })
        .eq("id", deviceId)
        .eq("user_id", userId);

      if (error) throw error;
    } catch {
      // Silently fail
    }
  }, []);

  return { toggleTrust };
}

export function useDevices() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDevices = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("user_devices")
        .select("id, device_name, is_trusted, os, browser, last_seen_at")
        .eq("user_id", userId)
        .order("last_seen_at", { ascending: false });

      if (!error && data) {
        setDevices(data as DeviceItem[]);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { devices, isLoading, loadDevices, refreshDevices: loadDevices };
}
