import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";

/**
 * Gera um fingerprint único do dispositivo.
 * Usa informações não sensíveis disponíveis no navegador.
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";

  const components = [
    navigator.userAgent,
    navigator.platform || "",
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    navigator.language || "",
  ];

  const raw = components.join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Hook para gerenciar device fingerprinting.
 * Gera e registra o fingerprint do dispositivo no backend.
 */
export function useDeviceFingerprint() {
  const fingerprint = useRef(generateDeviceFingerprint());

  const syncFingerprint = useCallback(async () => {
    if (!fingerprint.current || typeof window === "undefined") return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.id) return;

      await supabase.rpc("log_security_event", {
        p_event_type: "device_added",
        p_severity: "low",
        p_metadata: { fingerprint: fingerprint.current },
      });
    } catch {
      // Silently fail — fingerprinting is non-critical
    }
  }, []);

  useEffect(() => {
    if (fingerprint.current && typeof window !== "undefined") {
      syncFingerprint();
    }
  }, [syncFingerprint]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncFingerprint();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncFingerprint]);

  return fingerprint.current;
}
