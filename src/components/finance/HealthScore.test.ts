import { describe, expect, it } from "vitest";

import { calculateHealthScore } from "@/components/finance/HealthScore";

describe("calculateHealthScore", () => {
  it("retorna score alto para boa saúde financeira", () => {
    const result = calculateHealthScore({
      savingsRate: 35,
      totalAssets: 200000,
      totalDebts: 10000,
      monthlyTransactions: 30,
      uniqueCategories: 8,
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.breakdown.savingsRate).toBe(25);
    expect(result.breakdown.diversification).toBe(25);
    expect(result.breakdown.debtRatio).toBeGreaterThanOrEqual(20);
    expect(result.breakdown.regularity).toBe(25);
  });

  it("retorna score baixo para má saúde financeira", () => {
    const result = calculateHealthScore({
      savingsRate: 0,
      totalAssets: 10000,
      totalDebts: 15000,
      monthlyTransactions: 2,
      uniqueCategories: 1,
    });

    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.breakdown.savingsRate).toBe(0);
    expect(result.breakdown.diversification).toBe(0);
    expect(result.breakdown.regularity).toBeLessThanOrEqual(5);
  });

  it("score máximo é 100", () => {
    const result = calculateHealthScore({
      savingsRate: 50,
      totalAssets: 500000,
      totalDebts: 0,
      monthlyTransactions: 50,
      uniqueCategories: 10,
    });

    expect(result.score).toBe(100);
  });

  it("score mínimo é 0", () => {
    const result = calculateHealthScore({
      savingsRate: 0,
      totalAssets: 0,
      totalDebts: 0,
      monthlyTransactions: 0,
      uniqueCategories: 0,
    });

    expect(result.score).toBe(0);
  });

  it("lidou com dividas altas", () => {
    const result = calculateHealthScore({
      savingsRate: 20,
      totalAssets: 50000,
      totalDebts: 45000,
      monthlyTransactions: 15,
      uniqueCategories: 4,
    });

    expect(result.breakdown.debtRatio).toBeLessThanOrEqual(5);
  });
});
