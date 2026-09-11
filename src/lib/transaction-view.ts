import type { Transaction, TransactionStatus } from "@/shared/finance-types";
export const transactionStatusLabel: Record<TransactionStatus, string> = {
  pending: "Pendente",
  settled: "Confirmada",
  cancelled: "Cancelada",
  failed: "Falhou",
  reversed: "Estornada",
};
export function transactionStatusText(row: Transaction) {
  return row.status
    ? transactionStatusLabel[row.status]
    : row.pending
      ? "Pendente"
      : "Não informada";
}
export function canChangeTransactionStatus(row: Transaction) {
  return (
    !row.archivedAt &&
    (row.recordOrigin === "manual" || row.recordOrigin === "import") &&
    (row.status === "pending" || row.status === "settled")
  );
}
export const transactionKindLabel = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  investment: "Investimento",
} as const;
export type TransactionFilters = {
  search: string;
  status?: string;
  kind: string;
  account: string;
  category: string;
  from: string;
  to: string;
};
export const emptyTransactionFilters: TransactionFilters = {
  search: "",
  status: "all",
  kind: "all",
  account: "all",
  category: "all",
  from: "",
  to: "",
};
export function filterTransactions(rows: Transaction[], filters: TransactionFilters) {
  const search = filters.search.trim().toLocaleLowerCase("pt-BR");
  return rows.filter(
    (row) =>
      (!filters.status || filters.status === "all" || row.status === filters.status) &&
      (filters.kind === "all" || row.kind === filters.kind) &&
      (filters.account === "all" || row.accountId === filters.account) &&
      (filters.category === "all" || row.category === filters.category) &&
      (!filters.from || row.date.slice(0, 10) >= filters.from) &&
      (!filters.to || row.date.slice(0, 10) <= filters.to) &&
      (!search ||
        [row.description, row.merchant, row.category, row.accountName].some((value) =>
          value.toLocaleLowerCase("pt-BR").includes(search),
        )),
  );
}
export function transactionCsv(rows: Transaction[]) {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFFdata;descricao;estabelecimento;categoria;tipo;valor;situacao\r\n" +
    rows
      .map((row) =>
        [
          row.date.slice(0, 10),
          row.description,
          row.merchant,
          row.category,
          transactionKindLabel[row.kind],
          row.amount,
          transactionStatusText(row),
        ]
          .map((value, index) =>
            index === 5 ? Number(value).toFixed(2).replace(".", ",") : cell(value),
          )
          .join(";"),
      )
      .join("\r\n")
  );
}
