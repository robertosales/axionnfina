import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { TransactionRow } from "@/components/finance/TransactionRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recentTransactions, type TransactionKind } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transações — Axionn Finance" },
      {
        name: "description",
        content:
          "Explore, filtre e recategorize todas as transações das suas contas conectadas via Open Finance.",
      },
      { property: "og:title", content: "Transações — Axionn Finance" },
      {
        property: "og:description",
        content: "Lista consolidada de transações com filtros por tipo, categoria e conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const filters = [
  { key: "all", label: "Todas" },
  { key: "expense", label: "Despesas" },
  { key: "income", label: "Receitas" },
  { key: "transfer", label: "Transferências" },
  { key: "investment", label: "Investimentos" },
] as const;

function TransactionsPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof filters)[number]["key"]>("all");

  const rows = useMemo(
    () =>
      recentTransactions.filter((t) => {
        const matchKind = kind === "all" || t.kind === (kind as TransactionKind);
        const q = query.trim().toLowerCase();
        const matchQuery =
          q.length === 0 ||
          t.description.toLowerCase().includes(q) ||
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q);
        return matchKind && matchQuery;
      }),
    [kind, query],
  );

  const total = rows.reduce((sum, t) => sum + t.amount, 0);

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} lançamentos · saldo do filtro{" "}
            <span className="numeric font-medium text-foreground">{formatBRL(total)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="size-4" /> Exportar
          </Button>
          <Button size="sm">
            <Plus className="size-4" /> Nova transação
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden rounded-xl border-border/60 p-0 shadow-elevation-1">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por descrição, merchant ou categoria"
              className="pl-9"
              aria-label="Buscar transações"
            />
          </div>
          <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma transação encontrada com esses filtros.
          </p>
        ) : (
          <div>
            {rows.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
