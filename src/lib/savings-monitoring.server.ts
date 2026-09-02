import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { Transaction } from "@/lib/mock-data";
import { detectSavingsOpportunities } from "@/lib/savings-opportunities";

type DatabaseClient = SupabaseClient<Database>;
type DbJson = Database["public"]["Tables"]["savings_plans"]["Row"]["evidence"];

export type SavingsMonitoringResult = {
  userId: string;
  runDate: string;
  opportunitiesDetected: number;
  opportunitiesCreated: number;
};

export async function processSavingsMonitoringForUser(
  supabase: DatabaseClient,
  userId: string,
  runDate = new Date().toISOString().slice(0, 10),
): Promise<SavingsMonitoringResult> {
  const start = new Date(`${runDate}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 5);

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, account_id, description, merchant, category, type, amount, occurred_at, is_recurring, archived_at, record_origin, accounts(name)",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .gte("occurred_at", start.toISOString().slice(0, 10))
    .order("occurred_at", { ascending: false })
    .limit(5_000);
  if (error) throw error;

  const transactions: Transaction[] = (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    merchant: row.merchant ?? "",
    category: row.category,
    kind: row.type,
    amount: Number(row.amount),
    date: row.occurred_at,
    accountName: row.accounts?.name ?? "—",
    accountId: row.account_id,
    isRecurring: row.is_recurring,
    archivedAt: row.archived_at,
    recordOrigin: row.record_origin as NonNullable<Transaction["recordOrigin"]>,
  }));
  const opportunities = detectSavingsOpportunities({ transactions, referenceDate: runDate });

  if (opportunities.length === 0) {
    return {
      userId,
      runDate,
      opportunitiesDetected: 0,
      opportunitiesCreated: 0,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("savings_plans")
    .upsert(
      opportunities.map((opportunity) => ({
        user_id: userId,
        opportunity_key: opportunity.key,
        kind: opportunity.kind,
        title: opportunity.title,
        description: opportunity.description,
        category: opportunity.category,
        merchant: opportunity.merchant,
        baseline_monthly: opportunity.baselineMonthly,
        observed_amount: opportunity.observedAmount,
        target_monthly: Math.max(
          0,
          opportunity.baselineMonthly - opportunity.expectedMonthlySaving,
        ),
        expected_monthly_saving: opportunity.expectedMonthlySaving,
        confidence: opportunity.confidence,
        evidence: opportunity.evidence as unknown as DbJson,
        status: "detected",
        detected_on: runDate,
      })),
      { onConflict: "user_id,opportunity_key", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw insertError;

  return {
    userId,
    runDate,
    opportunitiesDetected: opportunities.length,
    opportunitiesCreated: inserted?.length ?? 0,
  };
}
