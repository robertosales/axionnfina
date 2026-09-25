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
 * Salva o fingerprint do dispositivo na tabela user_devices.
 * Retorna o device_id se já existir, ou cria um novo.
 */
export async function syncDeviceFingerprint(fingerprint: string): Promise<string | null> {
  if (!fingerprint || typeof window === "undefined") return null;

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user?.id) return null;

    const { data: existingDevices, error: fetchError } = await supabase
      .from("user_devices")
      .select("id")
      .eq("device_fingerprint", fingerprint)
      .eq("user_id", session.session.user.id)
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // Erro diferente de "não encontrado", ignorar
    }

    if (existingDevices?.id) {
      await supabase
        .from("user_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existingDevices.id);
      return existingDevices.id;
    }

    const { data: newDevice, error: insertError } = await supabase
      .from("user_devices")
      .insert({
        user_id: session.session.user.id,
        device_fingerprint: fingerprint,
        device_name: "Dispositivo Atual",
        device_type: navigator.maxTouchPoints > 0 ? "mobile" : "desktop",
        os: navigator.platform || "Desconhecido",
        browser: navigator.userAgent.split("(")[1]?.split(")")[0] || "Desconhecido",
        is_trusted: false,
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[DeviceFingerprint] Failed to insert:", insertError);
      return null;
    }

    await logSecurityEvent({
      eventType: "device_added",
      severity: "low",
      metadata: { fingerprint, deviceId: newDevice.id },
    });

    return newDevice.id;
  } catch {
    return null;
  }
}

/**
 * Hook para gerenciar device fingerprinting.
 * Gera e registra o fingerprint do dispositivo no backend.
 */
export function useDeviceFingerprint() {
  const fingerprint = useRef(generateDeviceFingerprint());

  const syncFingerprint = useCallback(async () => {
    if (!fingerprint.current || typeof window === "undefined") return null;

    try {
      const deviceId = await syncDeviceFingerprint(fingerprint.current);
      return deviceId;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (fingerprint.current && typeof window !== "undefined") {
      void syncFingerprint();
    }
  }, [syncFingerprint]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncFingerprint();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncFingerprint]);

  return fingerprint.current;
}
