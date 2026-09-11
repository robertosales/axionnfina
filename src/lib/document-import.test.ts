import { describe, expect, it } from "vitest";

import { parseInvoiceCsv, parseInvoiceText, parseStatementText, parseStatementXml, validatePdfFile } from "./document-import";

describe("document import", () => {
  it("parses compatible statement XML rows", () => {
    const rows = parseStatementXml(
      "<statement><transaction><date>04/09/2026</date><description>Mercado</description><amount>12,50</amount></transaction></statement>",
      "account-1",
    );
    expect(rows[0]).toMatchObject({ date: "2026-09-04", amount: 12.5, valid: true });
  });

  it("parses invoice installments and normalizes expenses", () => {
    const [row] = parseInvoiceCsv("data;estabelecimento;valor;parcela\n04/09/2026;Loja;100,00;2/6", "card-1");
    expect(row).toMatchObject({ amount: -100, installment: "2/6", valid: true });
  });

  it("rejects oversized or invalid PDF metadata", () => {
    expect(validatePdfFile({ name: "statement.pdf", size: 11_000_000 })).toContain("10 MB");
    expect(validatePdfFile({ name: "statement.pdf", size: 100, header: "not-pdf" })).toContain("válido");
  });

  it("turns extracted PDF text into statement rows", () => {
    const [row] = parseStatementText("04/09/2026 Mercado Extra 123,45", "account-1");
    expect(row).toMatchObject({ date: "2026-09-04", description: "Mercado Extra", amount: 123.45, valid: true });
  });

  it("parses Itaú statement rows without importing daily balances", () => {
    const rows = parseStatementText(
      [
        "11/09/2026 SALDO DO DIA -1.023,33",
        "10/09/2026 PAG BOLETO BANCO C6 S.A. -1.570,06",
        "04/09/2026 REMUNERACAO/SALARIO 10.799,21",
      ].join("\n"),
      "account-1",
    );

    expect(rows).toHaveLength(2);
    expect(rows).toMatchObject([
      { date: "2026-09-10", description: "PAG BOLETO BANCO C6 S.A.", amount: -1570.06, valid: true },
      { date: "2026-09-04", description: "REMUNERACAO/SALARIO", amount: 10799.21, valid: true },
    ]);
  });

  it("turns extracted PDF text into negative invoice rows", () => {
    const [row] = parseInvoiceText("04/09/2026 Loja Online 99,90", "card-1");
    expect(row).toMatchObject({ amount: -99.9, valid: true });
  });
});
