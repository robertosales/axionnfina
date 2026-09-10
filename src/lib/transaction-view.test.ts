import type { Transaction } from "@/shared/finance-types";
import { expect, it } from "vitest";
import { emptyTransactionFilters, filterTransactions, transactionCsv } from "./transaction-view";
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
