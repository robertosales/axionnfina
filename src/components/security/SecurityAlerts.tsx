import { useState, useEffect } from "react";
import { AlertTriangle, ShieldCheck, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { checkAlertRules } from "@/lib/security-alerts";
import { type RiskLevel } from "@/lib/security-risk";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SecurityAlerts() {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    ruleName: string;
    severity: RiskLevel;
    message: string;
    acknowledged: boolean;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = async () => {
    try {
      const activeAlerts = await checkAlertRules();
      setAlerts(activeAlerts);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
    const interval = setInterval(loadAlerts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await supabase.rpc("log_security_event", {
        p_event_type: "consent_created",
        p_severity: "low",
        p_metadata: { alertAcknowledged: alertId },
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
      toast.success("Alerta reconhecido");
    } catch {
      toast.error("Erro ao reconhecer alerta");
    }
  };

  const severityIcon = (severity: RiskLevel) => {
    switch (severity) {
      case "critical":
        return <XCircle className="size-5 text-destructive" />;
      case "high":
        return <ShieldAlert className="size-5 text-orange-500" />;
      case "medium":
        return <AlertTriangle className="size-5 text-yellow-500" />;
      default:
        return <CheckCircle2 className="size-5 text-chart-2" />;
    }
  };

  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Verificando alertas...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Alertas de Segurança</h2>
            <p className="text-sm text-muted-foreground">
              {activeAlerts.length > 0
                ? `${activeAlerts.length} alerta(s) ativo(s) precisa(m) de atenção`
                : "Nenhum alerta ativo"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadAlerts}>
          Atualizar
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta para exibir.</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between rounded-lg border border-border p-3 ${
                alert.acknowledged ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {severityIcon(alert.severity)}
                <div>
                  <p className="text-sm font-medium">{alert.ruleName}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={alert.severity === "critical" ? "destructive" : alert.severity === "high" ? "outline" : "secondary"}>
                  {alert.severity}
                </Badge>
                {!alert.acknowledged && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Reconhecer
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
