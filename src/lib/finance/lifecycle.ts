import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type LifecycleEntity =
  | "account"
  | "transaction"
  | "budget"
  | "goal"
  | "investment"
  | "investment_plan"
  | "private_offer"
  | "payable"
  | "receivable"
  | "tax_event"
  | "insight";

export const lifecycleQueryKey: Record<LifecycleEntity, string> = {
  account: "accounts",
  transaction: "transactions",
  budget: "budgets",
  goal: "goals",
  investment: "investments",
  investment_plan: "investment-plans",
  private_offer: "private-fixed-income-offers",
  payable: "payables",
  receivable: "receivables",
  tax_event: "tax-events",
  insight: "insights",
};

export async function setArchived(entity: LifecycleEntity, id: string, archived: boolean) {
  const archivedAt = archived ? new Date().toISOString() : null;
  const run = async () => {
    switch (entity) {
      case "account":
        return supabase
          .from("accounts")
          .update({ archived_at: archivedAt, is_archived: archived })
          .eq("id", id);
      case "transaction":
        return supabase.from("transactions").update({ archived_at: archivedAt }).eq("id", id);
      case "budget":
        return supabase.from("budgets").update({ archived_at: archivedAt }).eq("id", id);
      case "goal":
        return supabase.from("goals").update({ archived_at: archivedAt }).eq("id", id);
      case "investment":
        return supabase
          .from("investment_positions")
          .update({ archived_at: archivedAt })
          .eq("id", id);
      case "investment_plan":
        return supabase.from("investment_plans").update({ archived_at: archivedAt }).eq("id", id);
      case "private_offer":
        return supabase
          .from("private_fixed_income_offers")
          .update({ archived_at: archivedAt })
          .eq("id", id);
      case "payable":
        return supabase.from("payables").update({ archived_at: archivedAt }).eq("id", id);
      case "receivable":
        return supabase.from("receivables").update({ archived_at: archivedAt }).eq("id", id);
      case "tax_event":
        return supabase.from("tax_events").update({ archived_at: archivedAt }).eq("id", id);
      case "insight":
        return supabase.from("agent_insights").update({ archived_at: archivedAt }).eq("id", id);
    }
  };
  const { error } = await run();
  if (error) throw error;
}

export async function deleteEntity(entity: LifecycleEntity, id: string) {
  const run = async () => {
    switch (entity) {
      case "account":
        return supabase.from("accounts").delete().eq("id", id);
      case "transaction":
        return supabase.from("transactions").delete().eq("id", id);
      case "budget":
        return supabase.from("budgets").delete().eq("id", id);
      case "goal":
        return supabase.from("goals").delete().eq("id", id);
      case "investment":
        return supabase.from("investment_positions").delete().eq("id", id);
      case "investment_plan":
        return supabase.from("investment_plans").delete().eq("id", id);
      case "private_offer":
        return supabase.from("private_fixed_income_offers").delete().eq("id", id);
      case "payable":
        return supabase.from("payables").delete().eq("id", id);
      case "receivable":
        return supabase.from("receivables").delete().eq("id", id);
      case "tax_event":
        return supabase.from("tax_events").delete().eq("id", id);
      case "insight":
        return supabase.from("agent_insights").delete().eq("id", id);
    }
  };
  const { error } = await run();
  if (error) throw error;
}

export function useEntityLifecycle(entity: LifecycleEntity) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [lifecycleQueryKey[entity]] });
    if (entity === "account") void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    if (entity === "transaction") {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    }
    if (entity === "tax_event") void queryClient.invalidateQueries({ queryKey: ["taxes"] });
  };

  const archive = useMutation({
    mutationFn: (id: string) => setArchived(entity, id, true),
    onSuccess: invalidate,
  });
  const restore = useMutation({
    mutationFn: (id: string) => setArchived(entity, id, false),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEntity(entity, id),
    onSuccess: invalidate,
  });

  return { archive, restore, remove };
}
