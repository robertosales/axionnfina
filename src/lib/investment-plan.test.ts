import { describe, expect, it } from "vitest";

import { simulateInvestmentPlan } from "./investment-plan";
import type { InvestmentRadarResponse, RankedOpportunity } from "./investment-radar";

function opportunity(
  id: string,
  indexer: RankedOpportunity["indexer"],
  purchaseRate: number,
): RankedOpportunity {
  return {
    id,
    name: id,
    issuer: "Tesouro Nacional",
    indexer,
    maturityDate: "2035-01-01",
    referenceDate: "2026-08-28",
    purchaseRate,
    purchasePrice: 1_000,
    minimumInvestment: 30,
    liquidityDays: 0,
    riskLevel: indexer === "selic" ? 1 : 3,
    hasCoupons: false,
    source: "Tesouro Transparente",
    sourceUrl: "https://example.com",
    score: 90,
    fit: "high",
    rateLabel: indexer === "selic" ? "Selic + 0,03%" : `${purchaseRate}% a.a.`,
    summary: "",
    evidence: [],
    warnings: [],
  };
}

function radar(
  objective: InvestmentRadarResponse["profile"]["objective"],
): InvestmentRadarResponse {
  return {
    generatedAt: "2026-08-31T12:00:00Z",
    referenceDate: "2026-08-28",
    cacheStatus: "fresh",
    profile: {
      riskProfile: "moderate",
      horizonMonths: 60,
      liquidityPreference: "long_term",
      objective,
    },
    context: {
      reserveMonths: 6,
      monthlyExpenses: 2_000,
      liquidBalance: 12_000,
      nearestGoalMonths: null,
    },
    indicators: [
      {
        id: "selic",
        label: "Selic",
        value: 14.75,
        unit: "% a.a.",
        referenceDate: "2026-08-28",
        source: "Banco Central do Brasil",
        sourceUrl: "https://example.com",
      },
      {
        id: "ipca12m",
        label: "IPCA",
        value: 4.5,
        unit: "% a.a.",
        referenceDate: "2026-08-01",
        source: "Banco Central do Brasil",
        sourceUrl: "https://example.com",
      },
    ],
    opportunities: [
      opportunity("Tesouro Selic 2029", "selic", 0.03),
      opportunity("Tesouro Prefixado 2032", "fixed", 14.4),
      opportunity("Tesouro IPCA+ 2035", "ipca", 7.7),
    ],
    sourceHealth: [],
    disclaimer: "",
  };
}

describe("investment plan simulator", () => {
  it("aloca reserva somente no Tesouro Selic", () => {
    const simulation = simulateInvestmentPlan(radar("reserve"), {
      initialAmount: 1_000,
      monthlyContribution: 500,
      horizonMonths: 24,
    });

    expect(simulation.allocations).toHaveLength(1);
    expect(simulation.allocations[0]).toMatchObject({
      weight: 1,
      initialAmount: 1_000,
      monthlyAmount: 500,
    });
  });

  it("mantém pesos em 100% e calcula três cenários ordenados", () => {
    const simulation = simulateInvestmentPlan(radar("growth"), {
      initialAmount: 5_000,
      monthlyContribution: 800,
      horizonMonths: 60,
    });

    expect(simulation.allocations.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
    expect(simulation.scenarios).toHaveLength(3);
    expect(simulation.scenarios[0]!.estimatedNetValue).toBeLessThan(
      simulation.scenarios[1]!.estimatedNetValue,
    );
    expect(simulation.scenarios[1]!.estimatedNetValue).toBeLessThan(
      simulation.scenarios[2]!.estimatedNetValue,
    );
    expect(simulation.totalContributed).toBe(53_000);
  });

  it("normaliza entradas negativas", () => {
    const simulation = simulateInvestmentPlan(radar("growth"), {
      initialAmount: -1,
      monthlyContribution: -10,
      horizonMonths: 0,
    });

    expect(simulation.input).toEqual({
      initialAmount: 0,
      monthlyContribution: 0,
      horizonMonths: 1,
    });
  });
});
