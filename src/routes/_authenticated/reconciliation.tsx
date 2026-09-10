import { DataState } from "@/components/finance/DataState";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reconciliation")({
  head: () => ({ meta: [{ title: "Conferência de saldos — Axionn Finance" }] }),
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const accounts = useAccounts();
  const reconciliation = useQuery({
    queryKey: ["account-reconciliation"],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("account_reconciliation")
        .select(
          "account_id, reported_balance, journal_movement_balance, difference_including_opening_balance",
        )
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  const amount = (value: number | null) => (value === null ? "Não informado" : formatBRL(value));
  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Conferência de saldos</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Compare o saldo informado da conta com seus movimentos contábeis. A diferença inclui o
          saldo inicial e, isoladamente, não indica erro nem confirma conciliação.
        </p>
      </header>
      <DataState
        loading={accounts.isLoading || reconciliation.isLoading}
        error={accounts.error || reconciliation.error}
        empty={!reconciliation.data?.length}
        onRetry={() => {
          void accounts.refetch();
          void reconciliation.refetch();
        }}
      >
        <Card className="overflow-hidden">
          <div
            className="overflow-auto"
            tabIndex={0}
            role="region"
            aria-label="Conferência de saldos por conta"
          >
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  {[
                    "Conta",
                    "Saldo informado",
                    "Movimentos contábeis",
                    "Diferença com saldo inicial",
                    "Consulta",
                  ].map((label, index) => (
                    <th
                      scope="col"
                      key={label}
                      className={`p-3 ${index > 0 && index < 4 ? "text-right" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconciliation.data?.map((row, index) => (
                  <tr key={row.account_id ?? index} className="border-t">
                    <th scope="row" className="p-3 text-left font-normal">
                      {accounts.data?.find((account) => account.id === row.account_id)?.name ??
                        "Conta não identificada"}
                    </th>
                    <td className="numeric whitespace-nowrap p-3 text-right">
                      {amount(row.reported_balance)}
                    </td>
                    <td className="numeric whitespace-nowrap p-3 text-right">
                      {amount(row.journal_movement_balance)}
                    </td>
                    <td className="numeric whitespace-nowrap p-3 text-right">
                      {amount(row.difference_including_opening_balance)}
                    </td>
                    <td className="p-3">
                      <Link
                        to="/transactions"
                        className="focus-ring rounded text-primary underline"
                      >
                        Ver lançamentos
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
    </AppShell>
  );
}
