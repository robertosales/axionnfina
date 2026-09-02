import { describe, expect, it } from "vitest";

import type { Transaction } from "./mock-data";
import { detectSavingsOpportunities } from "./savings-opportunities";

const expense = (
  id: string,
  date: string,
  amount: number,
  category: string,
  merchant: string,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id,
  date,
  amount: -amount,
  category,
  merchant,
  description: merchant,
  kind: "expense",
  accountName: "Conta",
  ...extra,
});

describe("detectSavingsOpportunities", () => {
  it("detecta uma assinatura mensal e estima o potencial de revisão", () => {
    const transactions = ["2026-05-10", "2026-06-10", "2026-07-10", "2026-08-10"].map(
      (date, index) => expense(`sub-${index}`, date, 39.9, "Assinaturas", "Stream Play"),
    );

    const result = detectSavingsOpportunities({ transactions, referenceDate: "2026-09-01" });

    expect(result[0]).toMatchObject({
      key: "subscription:stream-play",
      kind: "subscription",
      expectedMonthlySaving: 39.9,
    });
  });

  it("usa a marcação explícita de recorrência do banco", () => {
    const transactions = [
      expense("gym", "2026-08-05", 120, "Saúde", "Academia", { isRecurring: true }),
    ];

    const result = detectSavingsOpportunities({ transactions, referenceDate: "2026-09-01" });

    expect(result[0]).toMatchObject({ kind: "recurring", confidence: 95 });
  });

  it("detecta aumento relevante de uma categoria no último mês completo", () => {
    const transactions = [
      expense("food-1", "2026-05-05", 300, "Restaurantes", "Vários"),
      expense("food-2", "2026-06-05", 300, "Restaurantes", "Vários"),
      expense("food-3", "2026-07-05", 300, "Restaurantes", "Vários"),
      expense("food-4", "2026-08-05", 520, "Restaurantes", "Vários"),
    ];

    const result = detectSavingsOpportunities({ transactions, referenceDate: "2026-09-15" });
    const increase = result.find((item) => item.kind === "category_increase");

    expect(increase).toMatchObject({
      baselineMonthly: 300,
      observedAmount: 520,
      expectedMonthlySaving: 220,
    });
  });

  it("detecta uma compra individual muito acima do padrão", () => {
    const transactions = [
      expense("market-1", "2026-05-05", 45, "Mercado", "Mercado A"),
      expense("market-2", "2026-05-15", 50, "Mercado", "Mercado B"),
      expense("market-3", "2026-06-05", 40, "Mercado", "Mercado C"),
      expense("market-4", "2026-07-05", 55, "Mercado", "Mercado D"),
      expense("market-big", "2026-08-05", 300, "Mercado", "Mercado E"),
    ];

    const result = detectSavingsOpportunities({ transactions, referenceDate: "2026-09-01" });

    expect(result.find((item) => item.kind === "unusual_expense")).toMatchObject({
      key: "unusual:market-big",
      observedAmount: 300,
    });
  });

  it("ignora o mês atual incompleto e transações arquivadas", () => {
    const transactions = [
      expense("current", "2026-09-01", 2_000, "Lazer", "Viagem"),
      expense("archived", "2026-08-01", 2_000, "Lazer", "Viagem", {
        archivedAt: "2026-09-01T00:00:00Z",
        isRecurring: true,
      }),
    ];

    expect(detectSavingsOpportunities({ transactions, referenceDate: "2026-09-15" })).toHaveLength(
      0,
    );
  });
});
