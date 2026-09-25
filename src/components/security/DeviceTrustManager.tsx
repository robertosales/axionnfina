import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Hook para gerenciar device trust.
 * Permite marcar dispositivos como confiáveis ou não.
 */
export function useDeviceTrust() {
  const toggleTrust = async (deviceId: string, currentTrust: boolean) => {
    try {
      const { error } = await supabase
        .from("user_devices")
        .update({ is_trusted: !currentTrust })
        .eq("id", deviceId);

      if (error) throw error;

      await logSecurityEvent({
        eventType: currentTrust ? "device_removed" : "device_added",
        severity: currentTrust ? "medium" : "low",
        metadata: { deviceId, trusted: !currentTrust },
      });

      toast.success(
        currentTrust ? "Dispositivo removido dos confiáveis" : "Dispositivo marcado como confiável"
      );
    } catch {
      toast.error("Erro ao atualizar confiança do dispositivo");
    }
  };

  return { toggleTrust };
}

/**
 * Componente de gerenciamento de dispositivos confiáveis.
 * Exibe a lista de dispositivos e permite alternar a confiança.
 */
export function DeviceTrustManager() {
  const [devices, setDevices] = useState<Array<{ id: string; device_name: string; is_trusted: boolean }>>([]);

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("user_devices")
        .select("id, device_name, is_trusted")
        .order("last_seen_at", { ascending: false });

      if (!error && data) {
        setDevices(data);
      }
    } catch {
      // Silently fail
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Dispositivos Confiáveis</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Gerencie quais dispositivos são considerados confiáveis.
      </p>

      <div className="mt-4 space-y-2">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-3">
              <Badge variant={device.is_trusted ? "secondary" : "outline"}>
                {device.is_trusted ? "Confiável" : "Não confiável"}
              </Badge>
              <span className="text-sm">{device.device_name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDevices()}
            >
              Atualizar
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
