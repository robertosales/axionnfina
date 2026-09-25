import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterTransactions } from "@/lib/transaction-view";
import { useAccounts, useTransactions } from "@/lib/finance-data";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Download, ScrollText, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/wallet/statement")({
  head: () => ({
    meta: [
      { title: "Extrato de contas — Axionn Finance" },
      {
        name: "description",
        content: "Consulte o extrato por conta com período, busca e totais.",
      },
    ],
  }),
  component: StatementPage,
});

function StatementPage() {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    isError,
    error: queryError,
    refetch,
  } = useTransactions(null);
  const [accountId, setAccountId] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows = useMemo(
    () =>
      filterTransactions(transactions, {
        search,
        kind: "all",
        account: accountId,
        category: "all",
        status: "all",
        from: dateFrom,
        to: dateTo,
      }),
    [transactions, search, accountId, dateFrom, dateTo],
  );

  const income = useMemo(
    () => rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0),
    [rows],
  );
  const expenses = useMemo(
    () => rows.filter((r) => r.kind === "expense").reduce((s, r) => s + Math.abs(r.amount), 0),
    [rows],
  );
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const exportCsv = () => {
    const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const lines = [
      "﻿data;descricao;categoria;valor",
      ...rows.map((r) =>
        [
          r.date.slice(0, 10),
          r.description,
          r.category,
          Number(r.amount).toFixed(2).replace(".", ","),
        ]
          .map((v, i) => (i === 3 ? v : cell(v)))
          .join(";"),
      ),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "extrato-axionn.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Extrato de contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadingTransactions
              ? "Carregando extrato…"
              : `${rows.length} lançamento(s) no filtro`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Exportar
        </Button>
      </header>

      <section
        aria-label="Filtros do extrato"
        className="mb-5 rounded-lg border border-border bg-card p-4 shadow-none"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden /> Filtrar extrato
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>div]:space-y-2">
          <div>
            <Label htmlFor="statement-account">Conta</Label>
            <select
              id="statement-account"
              className="h-9 w-full rounded-md border bg-background px-2"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="all">Todas as contas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="statement-search">Buscar</Label>
            <Input
              id="statement-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Descrição ou categoria"
            />
          </div>
          <div>
            <Label htmlFor="statement-from">De</Label>
            <Input
              id="statement-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="statement-to">Até</Label>
            <Input
              id="statement-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Receitas no período</p>
          <p className="numeric mt-1 text-lg font-semibold text-income">{formatBRL(income)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Despesas no período</p>
          <p className="numeric mt-1 text-lg font-semibold text-expense">{formatBRL(expenses)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">
            {selectedAccount ? `Saldo atual · ${selectedAccount.name}` : "Resultado no período"}
          </p>
          <p className="numeric mt-1 text-lg font-semibold">
            {selectedAccount ? formatBRL(selectedAccount.balance) : formatBRL(income - expenses)}
          </p>
        </Card>
      </div>

      <DataState
        loading={loadingTransactions || loadingAccounts}
        error={queryError || isError}
        onRetry={() => void refetch()}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nenhum lançamento no filtro"
            description="Ajuste a conta ou o período para ver o extrato."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="whitespace-nowrap p-3">{formatDate(row.date)}</td>
                      <td className="max-w-64 truncate p-3 font-medium">{row.description}</td>
                      <td className="p-3 text-muted-foreground">{row.category}</td>
                      <td
                        className={cn(
                          "numeric whitespace-nowrap p-3 text-right font-medium",
                          row.kind === "income" ? "text-income" : "text-expense",
                        )}
                      >
                        {formatBRL(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </DataState>
    </AppShell>
  );
}
