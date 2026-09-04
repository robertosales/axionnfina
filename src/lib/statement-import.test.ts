import { describe, expect, it } from "vitest";

import { parseStatementCsv } from "./statement-import";

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
