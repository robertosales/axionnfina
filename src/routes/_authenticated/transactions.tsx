import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { TransactionRow } from "@/components/finance/TransactionRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type TransactionKind } from "@/lib/mock-data";
import {
  useAccounts,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransactionCategory,
} from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

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
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const createTransaction = useCreateTransaction();
  const updateCategory = useUpdateTransactionCategory();
  const deleteTransaction = useDeleteTransaction();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "expense" as "expense" | "income" | "transfer",
    category: "Outros",
    merchant: "",
    accountId: "",
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const categories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category))).sort(),
    [transactions],
  );

  const submit = () => {
    const value = Math.abs(Number(form.amount.replace(",", ".")));
    if (!form.description.trim() || !Number.isFinite(value) || value === 0) {
      toast.error("Informe descrição e valor");
      return;
    }
    createTransaction.mutate(
      {
        description: form.description.trim(),
        amount: form.type === "income" ? value : -value,
        type: form.type,
        category: form.category.trim() || "Outros",
        merchant: form.merchant.trim() || form.description.trim(),
        accountId: form.accountId || null,
        occurredAt: form.occurredAt,
      },
      {
        onSuccess: () => {
          toast.success("Transação registrada");
          setOpen(false);
          setForm((prev) => ({ ...prev, description: "", amount: "", merchant: "" }));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const exportCsv = () => {
    const header = "data;descricao;estabelecimento;categoria;tipo;valor";
    const body = rows
      .map((t) =>
        [t.date, t.description, t.merchant, t.category, t.kind, t.amount.toFixed(2)]
          .map((field) => String(field).replaceAll(";", ","))
          .join(";"),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transacoes-axionn.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const rows = useMemo(
    () =>
      transactions.filter((t) => {
        const matchKind = kind === "all" || t.kind === (kind as TransactionKind);
        const q = query.trim().toLowerCase();
        const matchQuery =
          q.length === 0 ||
          t.description.toLowerCase().includes(q) ||
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q);
        return matchKind && matchQuery;
      }),
    [kind, query, transactions],
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
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
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
            {isLoading ? "Carregando transações…" : "Nenhuma transação encontrada."}
          </p>
        ) : (
          <div>
            {rows.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                categories={categories}
                onCategoryChange={(category) =>
                  updateCategory.mutate(
                    { id: t.id, category },
                    {
                      onSuccess: () => toast.success("Categoria atualizada"),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
                onDelete={() =>
                  deleteTransaction.mutate(t.id, {
                    onSuccess: () => toast.success("Transação excluída"),
                    onError: (error) => toast.error(error.message),
                  })
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.occurredAt}
                  onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((p) => ({ ...p, type: v as typeof p.type }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  list="new-tx-categories"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                />
                <datalist id="new-tx-categories">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
            </div>
            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Select
                  value={form.accountId}
                  onValueChange={(v) => setForm((p) => ({ ...p, accountId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
