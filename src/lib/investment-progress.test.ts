import { describe, expect, it } from "vitest";

import type { SavedInvestmentPlan } from "./investment-plan";
import { calculateInvestmentPlanProgress } from "./investment-progress";

const plan: SavedInvestmentPlan = {
  id: "plan-1",
  name: "Plano principal",
  input: { initialAmount: 1_000, monthlyContribution: 600, horizonMonths: 60 },
  allocations: [
    {
      opportunityId: "selic",
      name: "Tesouro Selic 2029",
      weight: 0.6,
      initialAmount: 600,
      monthlyAmount: 360,
      annualRate: 14.7,
      rateLabel: "Selic",
      reason: "Liquidez",
    },
    {
      opportunityId: "ipca",
      name: "Tesouro IPCA+ 2035",
      weight: 0.4,
      initialAmount: 400,
      monthlyAmount: 240,
      annualRate: 12,
      rateLabel: "IPCA + 7%",
      reason: "Inflação",
    },
  ],
  scenarios: [],
  marketReferenceDate: "2026-08-28",
  profileSnapshot: {
    riskProfile: "moderate",
    horizonMonths: 60,
    liquidityPreference: "long_term",
    objective: "growth",
  },
  archivedAt: null,
  createdAt: "2026-08-31T12:00:00Z",
  updatedAt: "2026-08-31T12:00:00Z",
};

describe("investment plan progress", () => {
  it("identifica carteira alinhada por nome e ticker", () => {
    const progress = calculateInvestmentPlanProgress(plan, [
      { id: "p1", ticker: "SELIC29", name: "Tesouro Selic 2029", marketValue: 6_000 },
      { id: "p2", ticker: "IPCA35", name: "Tesouro IPCA+ 2035", marketValue: 4_000 },
    ]);

    expect(progress.status).toBe("aligned");
    expect(progress.overallDrift).toBe(0);
    expect(progress.lines[0]?.matchedPositionIds).toEqual(["p1"]);
  });

  it("direciona o próximo aporte para a posição abaixo do alvo", () => {
    const progress = calculateInvestmentPlanProgress(plan, [
      { id: "p1", ticker: "SELIC29", name: "Tesouro Selic 2029", marketValue: 8_000 },
      { id: "p2", ticker: "IPCA35", name: "Tesouro IPCA+ 2035", marketValue: 2_000 },
    ]);

    expect(progress.status).toBe("off_track");
    expect(
      progress.lines.find((line) => line.opportunityId === "ipca")?.suggestedContribution,
    ).toBe(600);
    expect(
      progress.lines.find((line) => line.opportunityId === "selic")?.suggestedContribution,
    ).toBe(0);
  });

  it("classifica ativos fora do plano como desvio", () => {
    const progress = calculateInvestmentPlanProgress(plan, [
      { id: "p1", ticker: "PETR4", name: "Petrobras", marketValue: 10_000 },
    ]);

    expect(progress.unmatchedWeight).toBe(1);
    expect(progress.overallDrift).toBe(100);
  });
});
