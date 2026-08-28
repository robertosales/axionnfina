import { supabase } from "@/integrations/supabase/client";

/**
 * SecurityRiskService — Análise de risco e detecção de anomalias de segurança.
 *
 * Este serviço é DETERMINÍSTICO — a LLM não deve calcular riscos diretamente.
 * Cada função retorna um resultado estruturado com score e evidências.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type SecurityEventType =
  | "login"
  | "logout"
  | "login_failed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_challenge_success"
  | "mfa_challenge_failed"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "account_connected"
  | "account_removed"
  | "consent_created"
  | "consent_revoked"
  | "payment_created"
  | "payment_confirmed"
  | "payment_cancelled"
  | "payment_settled"
  | "profile_changed"
  | "investment_simulation"
  | "recommendation_generated"
  | "data_exported"
  | "account_deleted"
  | "session_revoked"
  | "device_added"
  | "device_removed"
  | "suspicious_activity";

export type SecurityEvent = {
  id: string;
  user_id: string;
  event_type: SecurityEventType;
  severity: RiskLevel;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  country: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Device = {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string;
  device_type: string;
  os: string | null;
  browser: string | null;
  is_trusted: boolean;
  last_seen_at: string;
  created_at: string;
};

export type SessionMetadata = {
  id: string;
  user_id: string;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  is_active: boolean;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
};

export type RiskAssessment = {
  level: RiskLevel;
  score: number; // 0-100
  reasons: string[];
  recommendations: string[];
};

/**
 * Analisa o risco de um login com base em padrões históricos.
 */
export async function assessLoginRisk(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
  deviceId: string | null,
): Promise<RiskAssessment> {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  // Verificar IP desconhecido
  const { data: knownIps } = await supabase
    .from("security_events")
    .select("ip_address")
    .eq("user_id", userId)
    .eq("event_type", "login")
    .not("ip_address", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const uniqueIps = new Set(knownIps?.map((e) => e.ip_address));
  if (ipAddress && knownIps && !uniqueIps.has(ipAddress)) {
    score += 30;
    reasons.push("IP desconhecido detectado");
    recommendations.push("Verifique se este IP pertence a você");
  }

  // Verificar dispositivo desconhecido
  const { data: knownDevices } = await supabase
    .from("user_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("is_trusted", true);

  if (deviceId && knownDevices && !knownDevices.find((d) => d.id === deviceId)) {
    score += 25;
    reasons.push("Dispositivo não confiável");
    recommendations.push("Marque este dispositivo como confiável se for seu");
  }

  // Verificar múltiplas falhas de login recentes
  const { count: failedCount } = await supabase
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "login_failed")
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  if (failedCount && failedCount >= 3) {
    score += 35;
    reasons.push(`${failedCount} tentativas de login falhadas nos últimos 15 minutos`);
    recommendations.push("Considere alterar sua senha");
  }

  // Verificar horário incomum (2h-5h da manhã)
  const hour = new Date().getHours();
  if (hour >= 2 && hour <= 5) {
    score += 10;
    reasons.push("Login em horário incomum (2h-5h)");
  }

  // Verificar mudança de país
  const { data: lastLogin } = await supabase
    .from("security_events")
    .select("country")
    .eq("user_id", userId)
    .eq("event_type", "login")
    .not("country", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastLogin?.country && ipAddress) {
    // Simplificação — em produção usar GeoIP
    score += 0; // Placeholder para detecção de país
  }

  const level = getRiskLevel(score);

  return { level, score, reasons, recommendations };
}

/**
 * Verifica se uma operação requer step-up authentication.
 */
export function requiresStepUpAuth(operation: string): boolean {
  const sensitiveOps = [
    "pix_send",
    "transfer",
    "password_change",
    "mfa_change",
    "account_delete",
    "consent_revoke",
    "email_change",
    "data_export",
    "payment_create",
    "payment_confirm",
  ];
  return sensitiveOps.includes(operation);
}

/**
 * Calcula o risco de uma operação financeira.
 */
export function assessFinancialOperationRisk(params: {
  amount: number;
  recipientKnown: boolean;
  userId: string;
  recentSimilarCount: number;
  hourOfDay: number;
}): RiskAssessment {
  const { amount, recipientKnown, recentSimilarCount, hourOfDay } = params;
  const reasons: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  // Valor alto
  if (amount > 10000) {
    score += 20;
    reasons.push(`Valor alto: R$ ${amount.toLocaleString("pt-BR")}`);
    recommendations.push("Confirme o valor antes de prosseguir");
  }

  if (amount > 50000) {
    score += 20;
    reasons.push("Valor muito alto — requer atenção");
    recommendations.push("Verifique o destinatário cuidadosamente");
  }

  // Destinatário desconhecido
  if (!recipientKnown) {
    score += 25;
    reasons.push("Destinatário não está na lista de conhecidos");
    recommendations.push("Adicione o destinatário aos seus contatos");
  }

  // Múltiplas operações similares
  if (recentSimilarCount >= 3) {
    score += 15;
    reasons.push(`${recentSimilarCount} operações similares recentes`);
    recommendations.push("Verifique se há atividade suspeita");
  }

  // Horário incomum
  if (hourOfDay >= 0 && hourOfDay <= 5) {
    score += 10;
    reasons.push("Operação em horário incomum");
  }

  const level = getRiskLevel(score);

  return { level, score, reasons, recommendations };
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/**
 * Registra um evento de segurança.
 */
export async function logSecurityEvent(params: {
  eventType: SecurityEventType;
  severity?: RiskLevel;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  country?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("log_security_event", {
    p_event_type: params.eventType,
    p_severity: params.severity ?? "low",
    p_ip_address: params.ipAddress ?? null,
    p_user_agent: params.userAgent ?? null,
    p_device_id: params.deviceId ?? null,
    p_country: params.country ?? null,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("[SecurityRisk] Failed to log event:", error);
    return null;
  }

  return data as string;
}
