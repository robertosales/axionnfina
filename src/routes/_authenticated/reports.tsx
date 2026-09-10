import { DataState } from "@/components/finance/DataState";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCashflow } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Axionn Finance" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [months, setMonths] = useState(6);
  const cashflow = useCashflow(months);
  const exportReport = () => {
    const csv =
      "\uFEFFmes;receitas;despesas;resultado\r\n" +
      cashflow.data
        .map((row) =>
          [
            row.month,
            ...[row.receitas, row.despesas, row.saldo].map((value) =>
              value.toFixed(2).replace(".", ","),
            ),
          ].join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "fluxo-de-caixa.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receitas e despesas confirmadas. Transferências e lançamentos pendentes não entram no
            fluxo.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="report-period">Período</Label>
            <select
              id="report-period"
              className="block h-9 rounded-md border bg-background px-3"
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
            >
              {[3, 6, 12].map((value) => (
                <option key={value} value={value}>
                  Últimos {value} meses
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            disabled={cashflow.isLoading || cashflow.isError}
            onClick={exportReport}
          >
            Exportar relatório
          </Button>
        </div>
      </header>
      <DataState
        loading={cashflow.isLoading}
        error={cashflow.error}
        onRetry={() => void cashflow.refetch()}
      >
        <Card className="overflow-hidden">
          <div
            role="region"
            aria-label="Fluxo de caixa mensal"
            tabIndex={0}
            className="overflow-auto"
          >
            <table className="w-full min-w-[480px] text-sm">
              <caption className="p-4 text-left font-semibold">
                Fluxo de caixa · últimos {months} meses, incluindo o mês atual
              </caption>
              <thead>
                <tr>
                  <th className="p-3 text-left" scope="col">
                    Mês/ano
                  </th>
                  {["Receitas", "Despesas", "Resultado"].map((label) => (
                    <th key={label} className="p-3 text-right" scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashflow.data.map((row) => (
                  <tr key={row.month} className="border-t">
                    <th className="p-3 text-left font-normal" scope="row">
                      {row.month}
                    </th>
                    {[row.receitas, row.despesas, row.saldo].map((value, index) => (
                      <td key={index} className="numeric whitespace-nowrap p-3 text-right">
                        {formatBRL(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/transactions">Conferir e filtrar lançamentos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/reconciliation">Conferir saldos por conta</Link>
        </Button>
      </div>
    </AppShell>
  );
}
