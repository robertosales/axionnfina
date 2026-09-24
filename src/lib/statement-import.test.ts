import { describe, expect, it } from "vitest";

import { parseStatementCsv, planStatementImport } from "./statement-import";

describe("parseStatementCsv", () => {
  it("parses Brazilian CSV values and dates", () => {
    const rows = parseStatementCsv(
      "Data;Descrição;Valor\n04/09/2026;Mercado;1.234,56\n05/09/2026;Salário;5.000,00",
      "account-1",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2026-09-04", amount: 1234.56, valid: true });
  });

  it("marks malformed rows for review", () => {
    const [row] = parseStatementCsv("date,description,amount\nnot-a-date,,0", "account-1");
    expect(row?.valid).toBe(false);
    expect(row?.errors).toEqual(["Data inválida", "Descrição ausente", "Valor inválido"]);
  });
});

describe("planStatementImport", () => {
  const csv =
    "Data;Descrição;Valor\n04/09/2026;Mercado;10,00\n04/09/2026;Mercado;10,00\n05/09/2026;Salário;5.000,00";

  it("imports only rows whose key is not already in the database", () => {
    const rows = parseStatementCsv(csv, "account-1");
    const existing = new Set<string>([rows[2]!.externalId]);
    const plan = planStatementImport(rows, existing);
    expect(plan.newRows.map((row) => row.rowNumber)).toEqual([2]);
    expect(plan.duplicateCount).toBe(2);
    expect([...plan.duplicateRowNumbers].sort()).toEqual([3, 4]);
  });

  it("treats repeated rows inside the same file as duplicates", () => {
    const rows = parseStatementCsv(csv, "account-1");
    const plan = planStatementImport(rows, new Set());
    expect(plan.newRows.map((row) => row.rowNumber)).toEqual([2, 4]);
    expect(plan.duplicateCount).toBe(1);
    expect(plan.duplicateRowNumbers.has(3)).toBe(true);
  });

  it("imports every row when nothing was imported before", () => {
    const rows = parseStatementCsv(
      "Data;Descrição;Valor\n04/09/2026;Mercado;10,00\n05/09/2026;Salário;5.000,00\n06/09/2026;Uber;-8,50",
      "account-1",
    );
    const plan = planStatementImport(rows, new Set());
    expect(plan.newRows).toHaveLength(3);
    expect(plan.duplicateCount).toBe(0);
  });
});
