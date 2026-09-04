import { describe, expect, it } from "vitest";

import { calculateHealthScore } from "@/lib/financial-health";

describe("calculateHealthScore", () => {
  it("retorna score alto para boa saúde financeira", () => {
    const result = calculateHealthScore({
      monthlyIncome: 10000,
      monthlyExpenses: 6500,
      liquidAssets: 50000,
      totalDebts: 10000,
      overdueBills: 0,
      monthsObserved: 6,
      transactionCount: 90,
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.breakdown.cashflow).toBe(30);
    expect(result.breakdown.reserve).toBe(30);
    expect(result.breakdown.debt).toBeGreaterThanOrEqual(20);
    expect(result.breakdown.commitments).toBe(15);
    expect(result.confidence).toBe("Alta");
  });

  it("retorna score baixo para má saúde financeira", () => {
    const result = calculateHealthScore({
      monthlyIncome: 3000,
      monthlyExpenses: 3500,
      liquidAssets: 0,
      totalDebts: 15000,
      overdueBills: 3,
      monthsObserved: 1,
      transactionCount: 2,
    });

    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.breakdown.cashflow).toBe(0);
    expect(result.breakdown.reserve).toBe(0);
    expect(result.breakdown.commitments).toBe(0);
  });

  it("score máximo é 100", () => {
    const result = calculateHealthScore({
      monthlyIncome: 10000,
      monthlyExpenses: 5000,
      liquidAssets: 30000,
      totalDebts: 0,
      overdueBills: 0,
      monthsObserved: 6,
      transactionCount: 60,
    });

    expect(result.score).toBe(100);
  });

  it("score mínimo é 0", () => {
    const result = calculateHealthScore({
      monthlyIncome: 0,
      monthlyExpenses: 0,
      liquidAssets: 0,
      totalDebts: 0,
      overdueBills: 3,
      monthsObserved: 0,
      transactionCount: 0,
    });

    expect(result.score).toBe(0);
  });

  it("lidou com dividas altas", () => {
    const result = calculateHealthScore({
      monthlyIncome: 5000,
      monthlyExpenses: 4000,
      liquidAssets: 5000,
      totalDebts: 60000,
      overdueBills: 0,
      monthsObserved: 4,
      transactionCount: 40,
    });

    expect(result.breakdown.debt).toBe(0);
  });
});
