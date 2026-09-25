import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";
import type { RiskLevel } from "@/lib/security-risk";
import type { SecurityEventType } from "@/lib/security-risk";

export type AlertRule = {
  id: string;
  name: string;
  eventType: SecurityEventType;
  threshold: number;
  windowMs: number;
  severity: RiskLevel;
  enabled: boolean;
};

export type Alert = {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: RiskLevel;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  acknowledged: boolean;
};

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "multiple_failed_logins",
    name: "Múltiplas falhas de login",
    eventType: "login_failed",
    threshold: 5,
    windowMs: 15 * 60 * 1000,
    severity: "high",
    enabled: true,
  },
  {
    id: "suspicious_activity",
    name: "Atividade suspeita detectada",
    eventType: "suspicious_activity",
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    severity: "critical",
    enabled: true,
  },
  {
    id: "new_device_login",
    name: "Login em dispositivo novo",
    eventType: "login",
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    severity: "medium",
    enabled: true,
  },
  {
    id: "account_deletion",
    name: "Conta excluída",
    eventType: "account_deleted",
    threshold: 1,
    windowMs: 24 * 60 * 60 * 1000,
    severity: "critical",
    enabled: true,
  },
];

export async function checkAlertRules(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user?.id) return alerts;

  const userId = session.session.user.id;

  for (const rule of DEFAULT_ALERT_RULES) {
    if (!rule.enabled) continue;

    const { data: events, error } = await supabase
      .from("security_events")
      .select("*")
      .eq("user_id", userId)
      .eq("event_type", rule.eventType satisfies SecurityEventType)
      .gte("created_at", new Date(Date.now() - rule.windowMs).toISOString())
      .order("created_at", { ascending: false });

    if (error || !events) continue;

    if (events.length >= rule.threshold) {
      alerts.push({
        id: `alert_${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Alerta: ${rule.name} — ${events.length} eventos no período`,
        metadata: { eventCount: events.length, ruleId: rule.id },
        createdAt: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  return alerts;
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await logSecurityEvent({
    eventType: "consent_created",
    severity: "low",
    metadata: { alertAcknowledged: alertId },
  });
}

export function getDefaultAlertRules(): AlertRule[] {
  return DEFAULT_ALERT_RULES;
}
