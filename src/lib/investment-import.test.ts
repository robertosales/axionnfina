import { describe, expect, it } from "vitest";
import { normalizeInvestmentPosition, parseInvestmentCsv } from "./investment-import";

describe("normalizeInvestmentPosition", () => {
  it("normaliza FII e preserva o saldo de mercado", () => {
    expect(
      normalizeInvestmentPosition({
        id: "1",
        type: "EQUITY",
        subtype: "REAL_ESTATE_FUND",
        name: "FII",
        code: "XPTO11",
        quantity: 2,
        value: 100,
        balance: 200,
      }),
    ).toMatchObject({
      assetClass: "fii",
      ticker: "XPTO11",
      quantity: 2,
      currentPrice: 100,
      marketValue: 200,
    });
  });

  it("identifica CDB e vencimento sem inventar preço", () => {
    expect(
      normalizeInvestmentPosition({
        id: "2",
        type: "FIXED_INCOME",
        subtype: "CDB",
        name: "CDB Banco",
        balance: 1200,
        amountOriginal: 1000,
        dueDate: "2030-01-10T00:00:00Z",
      }),
    ).toMatchObject({
      assetClass: "fixed_income",
      privateProductType: "cdb",
      quantity: 1,
      averagePrice: 1000,
      currentPrice: 1200,
      maturityDate: "2030-01-10",
    });
  });
});

describe("parseInvestmentCsv", () => {
  it("aceita cabeçalhos em português e números brasileiros", () => {
    const rows = parseInvestmentCsv(
      "Ativo;Nome;Classe;Quantidade;Preço Médio;Preço Atual;Instituição\nPETR4;Petrobras;Ações;10;32,50;35,10;Corretora A",
    );
    expect(rows[0]).toMatchObject({
      valid: true,
      ticker: "PETR4",
      assetClass: "stock",
      quantity: 10,
      averagePrice: 32.5,
      currentPrice: 35.1,
    });
  });

  it("marca linhas incompletas para revisão em vez de salvá-las", () => {
    const rows = parseInvestmentCsv(
      "Ativo,Nome,Classe,Quantidade,Preço Médio\n,Sem ativo,Desconhecida,0,10",
    );
    expect(rows[0]?.valid).toBe(false);
    expect(rows[0]?.errors).toContain("Ativo ausente");
  });
});
