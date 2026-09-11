import { DataState } from "@/components/finance/DataState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { localDateInput, parseFinancialInput } from "@/lib/financial-input";
import {
  filterTransactions,
  transactionCsv,
  transactionKindLabel,
  transactionStatusLabel,
  transactionStatusText,
  canChangeTransactionStatus,
} from "@/lib/transaction-view";
import { createFileRoute } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, Plus, SlidersHorizontal, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DataTable } from "@/components/ui/data-table";
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
import { supabase } from "@/integrations/supabase/client";
import { parseStatementXml } from "@/lib/document-import";
import {
  useAccounts,
  useCreateTransaction,
  useChangeTransactionStatus,
  useEntityLifecycle,
  useImportStatementTransactions,
  useTransactionCategories,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransactionCategory,
} from "@/lib/finance-data";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { parseStatementCsv, type StatementRow } from "@/lib/statement-import";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/shared/finance-types";

declare module "@tanstack/react-table" {
  interface TableMeta<TData> {
    editingId?: string | null;
    setEditingId?: (id: string | null) => void;
  }
}

export const Route = createFileRoute("/_authenticated/transactions")({
  validateSearch: (search: Record<string, unknown>): { new?: boolean; import?: boolean } => ({
    ...(search["new"] === true || search["new"] === "true" ? { new: true } : {}),
    ...(search["import"] === true || search["import"] === "true" ? { import: true } : {}),
  }),
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
  const { confirm, confirmation } = useFinancialConfirmation();
  const [kind, setKind] = useState<(typeof filters)[number]["key"]>("all");
  const [showArchived, setShowArchived] = useState(false);
  const {
    data: transactions = [],
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useTransactions(null, showArchived);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const { data: accounts = [] } = useAccounts();
  const { data: transactionCategories = [] } = useTransactionCategories();
  const createTransaction = useCreateTransaction();
  const changeStatus = useChangeTransactionStatus();
  const statusOperation = useRef(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const toggleStatus = useCallback(
    async (transaction: Transaction) => {
      if (statusOperation.current || !canChangeTransactionStatus(transaction)) return;
      const previousStatus = transaction.status;
      if (previousStatus !== "pending" && previousStatus !== "settled") return;
      const status = previousStatus === "pending" ? "settled" : "pending";
      statusOperation.current = true;
      setChangingStatus(true);
      try {
        if (
          !(await confirm(
            `${status === "settled" ? "Confirmar" : "Marcar como pendente"} “${transaction.description}”, ${formatBRL(transaction.amount)}, conta ${transaction.accountName}, data ${formatDate(transaction.date)}? ${status === "settled" ? "O lançamento passará a compor o saldo confirmado." : "O lançamento deixará de compor o saldo confirmado até uma nova confirmação."}${transaction.isRecurring ? " Somente este lançamento será alterado." : ""}`,
          ))
        )
          return;
        await changeStatus.mutateAsync({ id: transaction.id, previousStatus, status });
        toast.success(
          status === "settled" ? "Transação confirmada" : "Transação marcada como pendente",
        );
      } catch {
        toast.error("Não foi possível alterar a situação. Atualize a lista e tente novamente.");
        void refetch();
      } finally {
        statusOperation.current = false;
        setChangingStatus(false);
      }
    },
    [changeStatus, confirm, refetch],
  );
  const importTransactions = useImportStatementTransactions();
  const updateTransaction = useUpdateTransaction();
  const updateCategory = useUpdateTransactionCategory();
  const lifecycle = useEntityLifecycle("transaction");

  const [open, setOpen] = useState(Boolean(Route.useSearch().new));
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null);
  const importedEdit = transactions.find((transaction) => transaction.id === editTransactionId);
  const financialFieldsLocked =
    importedEdit?.recordOrigin === "open_finance" || importedEdit?.recordOrigin === "import";
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(Boolean(Route.useSearch().import));
  const [readingImport, setReadingImport] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const statementOperation = useRef(false);
  const [importRows, setImportRows] = useState<StatementRow[]>([]);
  const [importAccountId, setImportAccountId] = useState("");
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "expense" as "expense" | "income" | "transfer",
    category: "Outras despesas",
    merchant: "",
    accountId: "",
    occurredAt: localDateInput(),
  });

  const categories = useMemo(
    () =>
      transactionCategories
        .filter((category) => category.kind === form.type)
        .map((category) => category.label)
        .sort((left, right) => left.localeCompare(right, "pt-BR")),
    [form.type, transactionCategories],
  );

  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, {
      search,
      kind,
      account: accountFilter,
      category: categoryFilter,
      status: statusFilter,
      from: dateFrom,
      to: dateTo,
    });
  }, [transactions, kind, search, accountFilter, categoryFilter, statusFilter, dateFrom, dateTo]);

  const total = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions],
  );

  const openNewTransaction = useCallback(() => {
    setEditTransactionId(null);
    setForm({
      description: "",
      amount: "",
      type: "expense",
      category: "Outras despesas",
      merchant: "",
      accountId: "",
      occurredAt: localDateInput(),
    });
    setOpen(true);
  }, []);

  const readStatement = useCallback(
    async (file?: File) => {
      if (!file) return;
      const extension = file.name.toLowerCase().split(".").pop();
      if (file.size > 10 * 1024 * 1024 || !["csv", "xml", "pdf"].includes(extension ?? "")) {
        toast.error("Selecione um arquivo CSV, XML ou PDF de até 10 MB.");
        return;
      }
      const accountId = importAccountId;
      if (!accountId) {
        toast.error("Cadastre ou selecione uma conta antes de importar.");
        return;
      }
      let rows: StatementRow[];
      if (extension === "pdf") {
        const data = new FormData();
        data.append("file", file);
        data.append("kind", "statement");
        data.append("owner_id", accountId);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Sessão expirada");
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: data,
        });
        const result = (await response.json()) as { error?: string; rows?: StatementRow[] };
        if (!response.ok || !result.rows)
          throw new Error(result.error ?? "Não foi possível interpretar o PDF.");
        rows = result.rows;
      } else {
        const content = await file.text();
        rows =
          extension === "xml"
            ? parseStatementXml(content, accountId)
            : parseStatementCsv(content, accountId);
      }
      if (!rows.length) {
        toast.error("O arquivo não contém linhas de extrato.");
        return;
      }
      setImportAccountId(accountId);
      setImportRows(rows);
      setImportOpen(true);
    },
    [importAccountId],
  );

  const confirmImport = useCallback(async () => {
    if (statementOperation.current || !importAccountId || !importRows.some((row) => row.valid))
      return;
    statementOperation.current = true;
    setConfirmingImport(true);
    try {
      if (
        !(await confirm(
          `Importar ${importRows.filter((row) => row.valid).length} lançamento(s) para ${accounts.find((account) => account.id === importAccountId)?.name ?? "a conta selecionada"}? Confira os valores na prévia. Os lançamentos atualizarão o saldo da conta.`,
        ))
      )
        return;
      const result = await importTransactions.mutateAsync({
        accountId: importAccountId,
        rows: importRows,
      });
      toast.success(
        `${result.imported} lançamento(s) importado(s); ${result.ignored} ignorado(s).`,
      );
      setImportOpen(false);
      setImportRows([]);
    } catch {
      toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente.");
    } finally {
      statementOperation.current = false;
      setConfirmingImport(false);
    }
  }, [accounts, confirm, importAccountId, importRows, importTransactions]);

  const openEditTransaction = useCallback((transaction: Transaction) => {
    setEditTransactionId(transaction.id);
    setForm({
      description: transaction.description,
      amount: String(Math.abs(transaction.amount)),
      type: transaction.kind === "investment" ? "expense" : transaction.kind,
      category: transaction.category,
      merchant: transaction.merchant,
      accountId: transaction.accountId ?? "",
      occurredAt: transaction.date,
    });
    setOpen(true);
  }, []);

  const submit = useCallback(async () => {
    const value = parseFinancialInput(form.amount);
    if (!form.description.trim()) {
      toast.error("Informe a descrição da transação");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido maior que zero");
      return;
    }
    if (
      !form.category.trim() ||
      (!categories.includes(form.category) && form.category !== importedEdit?.category)
    ) {
      toast.error("Selecione uma categoria do tipo escolhido");
      return;
    }
    if (
      editTransactionId &&
      !(await confirm(
        `Salvar alterações em “${form.description}”, valor ${formatBRL(value)}, data ${formatDate(form.occurredAt)}?${importedEdit?.isRecurring ? " Somente este lançamento será alterado." : ""}`,
      ))
    )
      return;
    const payload = {
      description: form.description.trim(),
      amount:
        financialFieldsLocked && importedEdit
          ? importedEdit.amount
          : form.type === "income"
            ? value
            : -value,
      type: form.type,
      category: form.category.trim() || "Outros",
      merchant: form.merchant.trim() || form.description.trim(),
      accountId: form.accountId || null,
      occurredAt: form.occurredAt,
    };
    const options = {
      onSuccess: () => {
        toast.success(editTransactionId ? "Transação atualizada" : "Transação registrada");
        setOpen(false);
        setEditTransactionId(null);
        setForm((prev) => ({ ...prev, description: "", amount: "", merchant: "" }));
      },
      onError: (error: Error) =>
        toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
    };

    if (editTransactionId) {
      updateTransaction.mutate({ ...payload, id: editTransactionId }, options);
    } else {
      createTransaction.mutate(payload, options);
    }
  }, [
    form,
    categories,
    confirm,
    editTransactionId,
    createTransaction,
    updateTransaction,
    financialFieldsLocked,
    importedEdit,
  ]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([transactionCsv(filteredTransactions)], {
      type: "text/csv;charset=utf-8",
    });
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
              <p className="truncate text-xs text-muted-foreground">{row.original.accountName}</p>
            </div>
          </div>
        ),
      },
      {
        id: "date",
        accessorKey: "date",
        header: "Data",
        size: 100,
        cell: ({ row }) => <span className="text-sm">{formatDate(row.original.date)}</span>,
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
                aria-label="Editar categoria"
                className="focus-ring h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
                onBlur={(e) => {
                  if (e.target.dataset["cancelled"] === "true") return;
                  const newCategory = e.target.value.trim() || row.original.category;
                  updateCategory.mutate(
                    { id: row.original.id, category: newCategory },
                    {
                      onSuccess: () => {
                        toast.success("Categoria atualizada");
                        table.options.meta?.setEditingId?.(null);
                      },
                      onError: (error) =>
                        toast.error(
                          "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                        ),
                    },
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === "Escape") {
                    e.currentTarget.dataset["cancelled"] = "true";
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
          <span
            className={cn(
              "numeric text-right text-sm font-semibold",
              kindColors[row.original.kind],
            )}
          >
            {formatBRL(row.original.amount)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: transactionStatusText,
        header: "Situação",
        size: 190,
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <Badge
              variant="outline"
              className={
                row.original.status === "pending"
                  ? "text-warning"
                  : row.original.status === "settled"
                    ? "text-success"
                    : ""
              }
            >
              {transactionStatusText(row.original)}
            </Badge>
            {canChangeTransactionStatus(row.original) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={changingStatus}
                onClick={() => void toggleStatus(row.original)}
              >
                {row.original.status === "pending" ? "Confirmar transação" : "Marcar como pendente"}
              </Button>
            ) : row.original.recordOrigin === "open_finance" ? (
              <span className="text-xs text-muted-foreground">Informada pela instituição</span>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 60,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <EntityActionsMenu
              disabled={
                lifecycle.archive.isPending ||
                lifecycle.restore.isPending ||
                lifecycle.remove.isPending
              }
              entityLabel="transação"
              recordName={row.original.description}
              archived={Boolean(row.original.archivedAt)}
              onEdit={() => openEditTransaction(row.original)}
              onArchive={() =>
                lifecycle.archive.mutate(row.original.id, {
                  onSuccess: () => toast.success("Transação arquivada"),
                  onError: (error) =>
                    toast.error(
                      "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                    ),
                })
              }
              onRestore={() =>
                lifecycle.restore.mutate(row.original.id, {
                  onSuccess: () => toast.success("Transação restaurada"),
                  onError: (error) =>
                    toast.error(
                      "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                    ),
                })
              }
              onDelete={() =>
                lifecycle.remove.mutate(row.original.id, {
                  onSuccess: () => toast.success("Transação excluída"),
                  onError: (error) =>
                    toast.error(
                      "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                    ),
                })
              }
              deleteDisabledReason={
                row.original.recordOrigin !== "manual"
                  ? "Transações importadas devem ser arquivadas para não reaparecerem na sincronização."
                  : undefined
              }
            />
          </div>
        ),
      },
    ],
    [updateCategory, lifecycle, openEditTransaction, toggleStatus, changingStatus],
  );

  /* Sub-componente expandido */
  const renderSubComponent = useCallback(
    (row: { original: Transaction }) => (
      <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd className="font-medium capitalize">{transactionKindLabel[row.original.kind]}</dd>
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
        <div>
          <dt className="text-muted-foreground">Identificador</dt>
          <dd className="break-all">{row.original.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Origem</dt>
          <dd>
            {row.original.recordOrigin
              ? {
                  manual: "Manual",
                  open_finance: "Open Finance",
                  import: "Importação",
                  system: "Sistema",
                }[row.original.recordOrigin]
              : "Não informada"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Situação</dt>
          <dd>{transactionStatusText(row.original)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recorrência</dt>
          <dd>
            {row.original.isRecurring
              ? "Recorrente; edição somente deste lançamento"
              : "Não recorrente"}
          </dd>
        </div>
      </dl>
    ),
    [],
  );

  return (
    <AppShell onNewTransaction={openNewTransaction} newTransactionDisabled={showArchived}>
      {confirmation}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError
              ? "Dados indisponíveis"
              : isLoading
                ? "Carregando transações…"
                : `${filteredTransactions.length} lançamentos`}{" "}
            · total dos lançamentos do filtro{" "}
            <span className="numeric font-medium text-foreground">
              {isError || isLoading ? "—" : formatBRL(total)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((value) => !value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={isError || isLoading || filteredTransactions.length === 0}
          >
            <Download className="size-4" /> Exportar
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xml,.pdf,text/csv,application/xml,text/xml,application/pdf"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || statementOperation.current) return;
              statementOperation.current = true;
              setImportRows([]);
              setReadingImport(true);
              try {
                await readStatement(file);
              } catch {
                toast.error("Não foi possível ler o extrato. Confira o arquivo e tente novamente.");
              } finally {
                statementOperation.current = false;
                setReadingImport(false);
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            disabled={showArchived || readingImport}
          >
            <Upload className="size-4" /> {readingImport ? "Lendo extrato…" : "Importar extrato"}
          </Button>
          <Button size="sm" onClick={openNewTransaction} disabled={showArchived}>
            <Plus className="size-4" /> Nova transação
          </Button>
        </div>
      </header>

      <section
        aria-label="Filtros de transações"
        className="mb-5 rounded-2xl border border-border/50 bg-card p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden /> Filtrar transações
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>div]:space-y-2">
          <div>
            <Label htmlFor="transaction-search">Buscar transações</Label>
            <Input
              id="transaction-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Descrição, estabelecimento ou categoria"
            />
          </div>
          <div>
            <Label htmlFor="filter-account">Conta</Label>
            <select
              id="filter-account"
              className="h-9 w-full rounded-md border bg-background px-2"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
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
            <Label htmlFor="filter-category">Categoria</Label>
            <select
              id="filter-category"
              className="h-9 w-full rounded-md border bg-background px-2"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas as categorias</option>
              {Array.from(new Set(transactions.map((t) => t.category)))
                .sort()
                .map((category) => (
                  <option key={category}>{category}</option>
                ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filter-status">Situação</Label>
            <select
              id="filter-status"
              className="h-9 w-full rounded-md border bg-background px-2"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todas as situações</option>
              {Object.entries(transactionStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filter-from">De</Label>
            <Input
              id="filter-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="filter-to">Até</Label>
            <Input
              id="filter-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setKind("all");
              setAccountFilter("all");
              setCategoryFilter("all");
              setStatusFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpar filtros
          </Button>
        </div>
        {(search ||
          kind !== "all" ||
          accountFilter !== "all" ||
          categoryFilter !== "all" ||
          statusFilter !== "all" ||
          dateFrom ||
          dateTo ||
          showArchived) && (
          <div
            className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4"
            aria-label="Filtros ativos"
          >
            <span className="text-xs text-muted-foreground">Exibindo:</span>
            {search && (
              <Badge variant="secondary" className="max-w-full break-all whitespace-normal">
                Busca: {search}
              </Badge>
            )}
            {kind !== "all" && (
              <Badge variant="secondary">
                {filters.find((filter) => filter.key === kind)?.label}
              </Badge>
            )}
            {accountFilter !== "all" && (
              <Badge variant="secondary" className="max-w-full break-words whitespace-normal">
                Conta:{" "}
                {accounts.find((account) => account.id === accountFilter)?.name ?? accountFilter}
              </Badge>
            )}
            {categoryFilter !== "all" && (
              <Badge variant="secondary" className="max-w-full break-words whitespace-normal">
                Categoria: {categoryFilter}
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="secondary">
                Situação:{" "}
                {transactionStatusLabel[statusFilter as keyof typeof transactionStatusLabel]}
              </Badge>
            )}
            {dateFrom && <Badge variant="secondary">De: {formatDate(dateFrom)}</Badge>}
            {dateTo && <Badge variant="secondary">Até: {formatDate(dateTo)}</Badge>}
            {showArchived && <Badge variant="outline">Arquivadas</Badge>}
          </div>
        )}
      </section>
      <DataState loading={isLoading} error={queryError || isError} onRetry={() => void refetch()}>
        <DataTable
          columns={columns}
          data={filteredTransactions}
          getRowId={(row) => row.id}
          meta={{ editingId: editingCategoryId, setEditingId: setEditingCategoryId }}
          rowHeight={56}
          maxHeight={600}
          enableFiltering={false}
          filterPlaceholder="Buscar por descrição, estabelecimento ou categoria…"
          isLoading={isLoading}
          renderSubComponent={renderSubComponent}
          toolbar={
            <Tabs
              className="w-full min-w-0"
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
            >
              <TabsList className="h-auto w-full flex-wrap justify-start">
                {filters.map((f) => (
                  <TabsTrigger key={f.key} value={f.key} className="text-xs">
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        />
      </DataState>
      {/* Datalist para inline editing */}
      <datalist id="tx-categories-inline">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setEditTransactionId(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>{editTransactionId ? "Editar transação" : "Nova transação"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <ValidatedInput
                  required
                  id="description"
                  placeholder="Ex.: Parcela do financiamento"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Valor</Label>
                  <MoneyInput
                    min={0.01}
                    id="amount"
                    disabled={financialFieldsLocked}
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">Data</Label>
                  <ValidatedInput
                    required
                    id="date"
                    disabled={financialFieldsLocked}
                    type="date"
                    value={form.occurredAt}
                    onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="transaction-type">Tipo</Label>
                  <Select
                    value={form.type}
                    disabled={financialFieldsLocked}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        type: v as typeof p.type,
                        category:
                          transactionCategories.find((category) => category.kind === v)?.label ??
                          "",
                      }))
                    }
                  >
                    <SelectTrigger id="transaction-type">
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
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Categorias de{" "}
                    {form.type === "income"
                      ? "receita"
                      : form.type === "expense"
                        ? "despesa"
                        : "transferência"}
                    .
                  </p>
                </div>
              </div>
              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="transaction-account">Conta</Label>
                  <Select
                    value={form.accountId}
                    disabled={financialFieldsLocked}
                    onValueChange={(v) => setForm((p) => ({ ...p, accountId: v }))}
                  >
                    <SelectTrigger id="transaction-account">
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
              <Button
                data-financial-submit
                type="button"
                onClick={submit}
                disabled={createTransaction.isPending || updateTransaction.isPending}
              >
                {createTransaction.isPending || updateTransaction.isPending
                  ? "Salvando…"
                  : editTransactionId
                    ? "Salvar alterações"
                    : "Registrar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(value) => {
          if (!readingImport && !confirmingImport && !importTransactions.isPending)
            setImportOpen(value);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Conferir extrato antes de importar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="statement-account">Conta do extrato</Label>
            <Select
              value={importAccountId}
              disabled={readingImport || confirmingImport || importTransactions.isPending}
              onValueChange={(value) => {
                setImportAccountId(value);
                setImportRows([]);
              }}
            >
              <SelectTrigger id="statement-account">
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
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={
                !importAccountId ||
                readingImport ||
                confirmingImport ||
                importTransactions.isPending
              }
            >
              <Upload className="size-4" />{" "}
              {readingImport ? "Lendo extrato…" : "Selecionar CSV, XML ou PDF"}
            </Button>
            {!importRows.length && (
              <p className="text-sm text-muted-foreground">
                Selecione a conta e o arquivo para conferir os lançamentos.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[38rem] text-left text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2">Linha</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {importRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="p-2">{row.rowNumber}</td>
                      <td>{row.date ? row.date.split("-").reverse().join("/") : "—"}</td>
                      <td>{row.description || "-"}</td>
                      <td>{Number.isFinite(row.amount) ? formatBRL(row.amount) : "—"}</td>
                      <td className={row.valid ? "text-success" : "text-danger"}>
                        {row.valid ? "Pronta" : row.errors.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={confirmImport}
              disabled={
                readingImport ||
                confirmingImport ||
                !importAccountId ||
                importTransactions.isPending ||
                !importRows.some((row) => row.valid)
              }
            >
              {importTransactions.isPending ? "Importando…" : "Confirmar importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
