import { supabase } from "@/integrations/supabase/client";
import type { AssetClass } from "@/shared/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireUserId } from "./common";

export type TaxSummary = {
  year: number;
  month: number;
  swing_gross: number;
  swing_exempt: boolean;
  swing_tax: number;
  daytrade_tax: number;
  fii_tax: number;
  dividends: number;
  withheld: number;
  darf_due: number;
};

export function useTaxSummary(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return useQuery({
    queryKey: ["taxes", year, month],
    queryFn: async (): Promise<TaxSummary> => {
      const { data, error } = await supabase.rpc("calculate_irpf_monthly", {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      return data as unknown as TaxSummary;
    },
  });
}

export type TaxEvent = {
  id: string;
  kind: string;
  assetClass: AssetClass;
  ticker: string;
  grossAmount: number;
  profit: number;
  withheld: number;
  occurredAt: string;
  archivedAt: string | null;
  recordOrigin: "manual" | "open_finance" | "import" | "system";
};

export function useTaxEvents(showArchived = false) {
  return useQuery({
    queryKey: ["tax-events", showArchived],
    queryFn: async (): Promise<TaxEvent[]> => {
      let request = supabase
        .from("tax_events")
        .select(
          "id, kind, asset_class, ticker, gross_amount, profit, withheld, occurred_at, archived_at, record_origin",
        )
        .order("occurred_at", { ascending: false });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((event) => ({
        id: event.id,
        kind: event.kind,
        assetClass: event.asset_class,
        ticker: event.ticker,
        grossAmount: Number(event.gross_amount),
        profit: Number(event.profit),
        withheld: Number(event.withheld),
        occurredAt: event.occurred_at,
        archivedAt: event.archived_at,
        recordOrigin: event.record_origin as TaxEvent["recordOrigin"],
      }));
    },
  });
}

export function useUpsertTaxEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      kind: string;
      assetClass: AssetClass;
      ticker: string;
      grossAmount: number;
      profit: number;
      withheld: number;
      occurredAt: string;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        kind: input.kind,
        asset_class: input.assetClass,
        ticker: input.ticker.toUpperCase(),
        gross_amount: input.grossAmount,
        profit: input.profit,
        withheld: input.withheld,
        occurred_at: input.occurredAt,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("tax_events").update(payload).eq("id", input.id)
        : await supabase.from("tax_events").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-events"] });
      void queryClient.invalidateQueries({ queryKey: ["taxes"] });
    },
  });
}
