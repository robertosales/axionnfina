import { supabase } from "@/integrations/supabase/client";
import type { AgentInsight } from "@/shared/finance-types";
import { useQuery } from "@tanstack/react-query";
import { DbSeverity, MONTH_LABELS, severityToUi } from "./common";
import { useTransactions } from "./transactions";

export function useInsights(showArchived = false) {
  return useQuery({
    queryKey: ["insights", showArchived],
    queryFn: async (): Promise<AgentInsight[]> => {
      let request = supabase
        .from("agent_insights")
        .select("id, title, description, severity, archived_at, record_origin")
        .order("created_at", { ascending: false });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.description,
        severity: severityToUi[row.severity as DbSeverity],
        archivedAt: row.archived_at,
        recordOrigin: row.record_origin as NonNullable<AgentInsight["recordOrigin"]>,
      }));
    },
  });
}

export function useCashflow(months = 6) {
  const transactions = useTransactions(null);

  const buckets = new Map<
    string,
    { month: string; receitas: number; despesas: number; saldo: number }
  >();
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: `${MONTH_LABELS[d.getMonth()] ?? key}/${d.getFullYear()}`,
      receitas: 0,
      despesas: 0,
      saldo: 0,
    });
  }

  for (const tx of transactions.data ?? []) {
    if (tx.kind === "transfer" || tx.kind === "investment" || tx.pending || tx.archivedAt) continue;
    const key = tx.date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.amount >= 0) bucket.receitas += tx.amount;
    else bucket.despesas += Math.abs(tx.amount);
    bucket.saldo = bucket.receitas - bucket.despesas;
  }

  return {
    data: [...buckets.values()],
    isLoading: transactions.isLoading,
    isError: transactions.isError,
    error: transactions.error,
    isTruncated: false,
    refetch: transactions.refetch,
  };
}

export function useNetWorthSeries() {
  return useQuery({
    queryKey: ["net-worth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_snapshots")
        .select("month, net_worth")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        month: MONTH_LABELS[Number(row.month.slice(5, 7)) - 1] ?? row.month,
        date: row.month,
        value: Number(row.net_worth),
      }));
    },
  });
}
