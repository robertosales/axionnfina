import { createFileRoute } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { DataTable, CopyButton } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Transaction } from "@/lib/mock-data";
import {
  useAccounts,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransactionCategory,
} from "@/lib/finance-data";
import { formatBRL, formatShortDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const kindColors: Record<Transaction["kind"], string> = {
  income: "text-income",
  expense: "text-expense",
  transfer: "text-transfer",
  investment: "text-investment",
};

function TransactionsPage() {
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => kind === "all" || t.kind === kind);
  }, [transactions, kind]);

  const total = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions],
  );

  const submit = useCallback(() => {
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
  }, [form, createTransaction]);

  const exportCsv = useCallback(() => {
    const header = "data;descricao;estabelecimento;categoria;tipo;valor";
    const body = filteredTransactions
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
  }, [filteredTransactions]);

  /* Colunas da tabela */
  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      {
        id: "description",
        accessorKey: "description",
        header: "Descrição",
        size: 300,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
              {initials(row.original.merchant)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.original.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.accountName}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "date",
        accessorKey: "date",
        header: "Data",
        size: 100,
        cell: ({ row }) => (
          <span className="text-sm">{formatShortDate(row.original.date)}</span>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        header: "Categoria",
        size: 180,
        cell: ({ row, table }) => {
          const isEditing = table.options.meta?.editingId === row.original.id;
          if (isEditing) {
            return (
              <input
                list="tx-categories-inline"
                defaultValue={row.original.category}
                autoFocus
                className="focus-ring h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
                onBlur={(e) => {
                  const newCategory = e.target.value.trim() || row.original.category;
                  updateCategory.mutate(
                    { id: row.original.id, category: newCategory },
                    {
                      onSuccess: () => {
                        toast.success("Categoria atualizada");
                        table.options.meta?.setEditingId?.(null);
                      },
                      onError: (error) => toast.error(error.message),
                    },
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === "Escape") {
                    table.options.meta?.setEditingId?.(null);
                  }
                }}
              />
            );
          }
          return (
            <button
              type="button"
              onClick={() => table.options.meta?.setEditingId?.(row.original.id)}
              className="focus-ring rounded-md border border-transparent px-2 py-0.5 text-xs transition-colors hover:border-border hover:bg-muted"
            >
              {row.original.category}
            </button>
          );
        },
      },
      {
        id: "merchant",
        accessorKey: "merchant",
        header: "Estabelecimento",
        size: 160,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="truncate text-sm">{row.original.merchant}</span>
            <CopyButton value={row.original.merchant} />
          </div>
        ),
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: "Valor",
        size: 140,
        cell: ({ row }) => (
          <span className={cn("numeric text-right text-sm font-semibold", kindColors[row.original.kind])}>
            {formatBRL(row.original.amount)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 60,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                deleteTransaction.mutate(row.original.id, {
                  onSuccess: () => toast.success("Transação excluída"),
                  onError: (error) => toast.error(error.message),
                });
              }}
              className="focus-ring rounded p-1 text-muted-foreground transition-colors hover:text-danger"
              title="Excluir"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [updateCategory, deleteTransaction],
  );

  /* Sub-componente expandido */
  const renderSubComponent = useCallback(
    (row: { original: Transaction }) => (
      <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd className="font-medium capitalize">{row.original.kind}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estabelecimento</dt>
          <dd className="font-medium">{row.original.merchant}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Categoria</dt>
          <dd className="font-medium">{row.original.category}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Conta</dt>
          <dd className="font-medium">{row.original.accountName}</dd>
        </div>
      </div>
    ),
    [],
  );

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredTransactions.length} lançamentos · saldo do filtro{" "}
            <span className="numeric font-medium text-foreground">{formatBRL(total)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredTransactions.length === 0}>
            <Download className="size-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nova transação
          </Button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filteredTransactions}
        rowHeight={56}
        maxHeight={600}
        enableFiltering
        filterPlaceholder="Buscar por descrição, merchant ou categoria…"
        isLoading={isLoading}
        renderSubComponent={renderSubComponent}
        toolbar={
          <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {/* Datalist para inline editing */}
      <datalist id="tx-categories-inline">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

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
