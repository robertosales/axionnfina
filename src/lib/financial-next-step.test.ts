import { describe, expect, it } from "vitest";

import { analyzeFinancialReadiness, type FinancialReadinessInput } from "./financial-next-step";

const transactions = ["2026-06", "2026-07", "2026-08"].flatMap((month, monthIndex) => [
  { kind: "income" as const, amount: 5_000, date: `${month}-05`, category: "Renda" },
  ...Array.from({ length: 5 }, (_, index) => ({
    kind: "expense" as const,
    amount: 500,
    date: `${month}-${String(10 + index).padStart(2, "0")}`,
    category: monthIndex === 0 ? "Moradia" : "Alimentação",
  })),
]);

const base: FinancialReadinessInput = {
  accounts: [{ type: "CHECKING", balance: 9_000 }],
  transactions,
  bills: [],
  goals: [{ id: "goal-1" }],
  investmentTotal: 0,
  referenceDate: "2026-08-20",
};

describe("analyzeFinancialReadiness", () => {
  it("prioriza contas atrasadas", () => {
    const result = analyzeFinancialReadiness({
      ...base,
      bills: [{ status: "OVERDUE", amount: 340 }],
    });

    expect(result.stage).toBe("organize");
    expect(result.href).toBe("/bills");
    expect(result.metrics.overdueAmount).toBe(340);
  });

  it("pede conexão quando não há dados suficientes", () => {
    const result = analyzeFinancialReadiness({ ...base, accounts: [], transactions: [] });

    expect(result.href).toBe("/wallet/connect");
    expect(result.confidence.label).toBe("Baixa");
  });

  it("prioriza recuperar a sobra quando despesas superam a renda", () => {
    const result = analyzeFinancialReadiness({
      ...base,
      transactions: transactions.map((item) =>
        item.kind === "expense" ? { ...item, amount: 1_100 } : item,
      ),
    });

    expect(result.stage).toBe("economize");
    expect(result.href).toBe("/budget");
    expect(result.metrics.monthlySurplus).toBeLessThan(0);
  });

  it("prioriza dívida de cartão antes da reserva", () => {
    const result = analyzeFinancialReadiness({
      ...base,
      accounts: [
        { type: "CHECKING", balance: 1_000 },
        { type: "CREDIT_CARD", balance: -2_000 },
      ],
    });

    expect(result.stage).toBe("economize");
    expect(result.metrics.creditDebt).toBe(2_000);
  });

  it("sugere formar uma reserva inicial de três meses", () => {
    const result = analyzeFinancialReadiness({
      ...base,
      accounts: [{ type: "CHECKING", balance: 1_000 }],
    });

    expect(result.stage).toBe("protect");
    expect(result.metrics.reserveTarget).toBe(7_500);
    expect(result.suggestedAmount).toBe(1_250);
  });

  it("guia o primeiro investimento somente depois da base financeira", () => {
    const result = analyzeFinancialReadiness(base);

    expect(result.stage).toBe("invest");
    expect(result.confidence.label).toBe("Alta");
    expect(result.suggestedAmount).toBe(1_250);
  });

  it("passa a acompanhar quando já existe carteira", () => {
    const result = analyzeFinancialReadiness({ ...base, investmentTotal: 2_000 });

    expect(result.stage).toBe("track");
  });
});
