import { supabase } from "@/integrations/supabase/client";

/**
 * AuditService — Consulta e análise de logs de auditoria.
 *
 * Os logs são preenchidos por triggers no banco de dados.
 * Este serviço expõe consultas determinísticas para o frontend e IA.
 */

export type AuditLogEntry = {
  id: string;
  user_id: string | null;
  table_name: string;
  operation: string; // INSERT, UPDATE, DELETE
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  country: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogFilters = {
  table_name?: string;
  operation?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
};

/**
 * Busca logs de auditoria com filtros.
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
): Promise<{ data: AuditLogEntry[]; count: number }> {
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.table_name) {
    query = query.eq("table_name", filters.table_name);
  }
  if (filters.operation) {
    query = query.eq("operation", filters.operation);
  }
  if (filters.from_date) {
    query = query.gte("created_at", filters.from_date);
  }
  if (filters.to_date) {
    query = query.lte("created_at", filters.to_date);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("[AuditService] Query failed:", error);
    return { data: [], count: 0 };
  }

  return { data: (data as AuditLogEntry[]) ?? [], count: count ?? 0 };
}

/**
 * Busca mudanças em um registro específico.
 */
export async function getRecordAuditHistory(
  tableName: string,
  recordId: string,
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[AuditService] Record history query failed:", error);
    return [];
  }

  return (data as AuditLogEntry[]) ?? [];
}

/**
 * Resumo de atividade de auditoria.
 */
export async function getAuditSummary(days: number = 30): Promise<{
  totalOperations: number;
  byTable: Record<string, number>;
  byOperation: Record<string, number>;
  recentActivity: AuditLogEntry[];
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    return { totalOperations: 0, byTable: {}, byOperation: {}, recentActivity: [] };
  }

  const logs = data as AuditLogEntry[];
  const byTable: Record<string, number> = {};
  const byOperation: Record<string, number> = {};

  for (const log of logs) {
    byTable[log.table_name] = (byTable[log.table_name] ?? 0) + 1;
    byOperation[log.operation] = (byOperation[log.operation] ?? 0) + 1;
  }

  return {
    totalOperations: logs.length,
    byTable,
    byOperation,
    recentActivity: logs.slice(0, 10),
  };
}

/**
 * Detecta atividade suspeita nos logs de auditoria.
 */
export async function detectSuspiciousActivity(
  userId: string,
): Promise<{
  suspicious: boolean;
  reasons: string[];
  events: AuditLogEntry[];
}> {
  const reasons: string[] = [];
  const events: AuditLogEntry[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Muitas operações DELETE em curto período
  const { data: deletes } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("operation", "DELETE")
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false });

  if (deletes && deletes.length > 10) {
    reasons.push(`${deletes.length} exclusões na última hora`);
    events.push(...(deletes as AuditLogEntry[]));
  }

  // Operações em tabelas sensíveis
  const sensitiveTables = ["openfinance_tokens", "agent_memories", "investment_positions"];
  const { data: sensitiveOps } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .in("table_name", sensitiveTables)
    .gte("created_at", oneHourAgo);

  if (sensitiveOps && sensitiveOps.length > 5) {
    reasons.push(`${sensitiveOps.length} operações em tabelas sensíveis na última hora`);
    events.push(...(sensitiveOps as AuditLogEntry[]));
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
    events: events.slice(0, 20),
  };
}
