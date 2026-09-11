import type { Transaction } from "@/shared/finance-types";
import { expect, it } from "vitest";
import {
  emptyTransactionFilters,
  filterTransactions,
  transactionCsv,
  transactionStatusText,
  canChangeTransactionStatus,
} from "./transaction-view";
const rows: Transaction[] = [
  {
    id: "1",
    description: "Mercado; bairro",
    merchant: 'Loja "A"',
    category: "Alimentação",
    kind: "expense",
    amount: -1234.56,
    date: "2026-09-10",
    accountId: "a",
    accountName: "Conta A",
  },
  {
    id: "2",
    description: "Salário",
    merchant: "Empresa",
    category: "Salário",
    kind: "income",
    amount: 5000,
    date: "2026-08-01",
    accountId: "b",
    accountName: "Conta B",
  },
];
it("combina busca, tipo, conta, categoria e período sobre o mesmo conjunto exportado", () => {
  const selected = filterTransactions(rows, {
    ...emptyTransactionFilters,
    search: "MERCADO",
    kind: "expense",
    account: "a",
    category: "Alimentação",
    from: "2026-09-01",
    to: "2026-09-30",
  });
  expect(selected.map((row) => row.id)).toEqual(["1"]);
  const csv = transactionCsv(selected);
  expect(csv).toContain('"Mercado; bairro"');
  expect(csv).toContain('"Loja ""A"""');
  expect(csv).toContain("-1234,56");
  expect(csv).not.toContain("5000,00");
});
it("preserva limites inclusivos e nenhum resultado", () => {
  expect(
    filterTransactions(rows, { ...emptyTransactionFilters, from: "2026-09-10", to: "2026-09-10" }),
  ).toHaveLength(1);
  expect(
    filterTransactions(rows, { ...emptyTransactionFilters, search: "inexistente" }),
  ).toHaveLength(0);
});
it("neutraliza fórmulas de planilha nos campos textuais", () =>
  expect(transactionCsv([{ ...rows[0]!, description: "=1+1" }])).toContain("'=1+1"));

it("filtra e exporta a situação real, inclusive cancelamento, falha e estorno", () => {
  const transactions = (["pending", "settled", "cancelled", "failed", "reversed"] as const).map(
    (status) => ({ ...rows[0]!, id: status, status }),
  );
  expect(transactions.map(transactionStatusText)).toEqual([
    "Pendente",
    "Confirmada",
    "Cancelada",
    "Falhou",
    "Estornada",
  ]);
  const filtered = filterTransactions(transactions, {
    ...emptyTransactionFilters,
    status: "pending",
  });
  expect(filtered.map((row) => row.id)).toEqual(["pending"]);
  expect(transactionCsv(filtered)).toContain('"Pendente"');
  expect(transactionCsv(filtered)).not.toContain('"Confirmada"');
  expect(transactionStatusText(rows[0]!)).toBe("Não informada");
});
it("oferece alteração só em lançamentos locais ativos com situação reversível", () => {
  const row = { ...rows[0]!, status: "pending" as const, recordOrigin: "manual" as const };
  expect(canChangeTransactionStatus(row)).toBe(true);
  expect(canChangeTransactionStatus({ ...row, status: "settled", recordOrigin: "import" })).toBe(
    true,
  );
  expect(canChangeTransactionStatus({ ...row, recordOrigin: "open_finance" })).toBe(false);
  expect(canChangeTransactionStatus({ ...row, archivedAt: "2026-09-11" })).toBe(false);
  expect(canChangeTransactionStatus({ ...row, status: "reversed" })).toBe(false);
  expect(canChangeTransactionStatus({ ...rows[0]!, recordOrigin: "manual" })).toBe(false);
});
