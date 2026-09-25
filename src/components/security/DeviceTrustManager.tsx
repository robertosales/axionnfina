import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDevices, useDeviceTrust } from "@/hooks/use-device-trust";
import type { DeviceItem } from "@/hooks/use-device-trust";

export function DeviceTrustManager() {
  const { devices, isLoading, loadDevices } = useDevices();
  const { toggleTrust } = useDeviceTrust();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Dispositivos Confiáveis</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie quais dispositivos são considerados confiáveis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDevices}>
          Atualizar
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado.</p>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant={device.is_trusted ? "secondary" : "outline"}>
                  {device.is_trusted ? "Confiável" : "Não confiável"}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{device.device_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {device.os} · {device.browser} · Último acesso:{" "}
                    {new Date(device.last_seen_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleTrust(device.id, device.is_trusted)}
              >
                {device.is_trusted ? "Desmarcar" : "Marcar como confiável"}
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
