import { Bell, Settings } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SecurityNotifications() {
  const [notifications, setNotifications] = useState([
    { category: "login", label: "Login", enabled: true },
    { category: "password_change", label: "Alteração de senha", enabled: true },
    { category: "device_added", label: "Novo dispositivo", enabled: true },
    { category: "suspicious_activity", label: "Atividade suspeita", enabled: true },
    { category: "payment", label: "Pagamentos", enabled: false },
    { category: "consent", label: "Consentimentos", enabled: false },
  ]);

  const toggleNotification = async (category: string) => {
    const updated = notifications.map((n) =>
      n.category === category ? { ...n, enabled: !n.enabled } : n
    );
    setNotifications(updated);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.id) return;

      await supabase.rpc("log_security_event", {
        p_event_type: "consent_created",
        p_severity: "low",
        p_metadata: { category, enabled: updated.find((n) => n.category === category)?.enabled },
      });
    } catch {
      // Silently fail
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <Bell className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Notificações de Segurança</h2>
          <p className="text-sm text-muted-foreground">
            Controle quais alertas você recebe.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.category}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium">{notification.label}</p>
            </div>
            <Button
              variant={notification.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => toggleNotification(notification.category)}
            >
              {notification.enabled ? "Ativo" : "Inativo"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
