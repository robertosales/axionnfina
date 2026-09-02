import { describe, expect, it } from "vitest";

import type { FinancialReadiness } from "./financial-next-step";
import {
  buildFirstInvestmentGuidance,
  type FirstInvestmentAnswers,
} from "./first-investment-guide";

const answers: FirstInvestmentAnswers = {
  objective: "growth",
  horizonMonths: 120,
  liquidityPreference: "long_term",
  fluctuationTolerance: "some",
  knowledgeLevel: "basic",
};

const financial: FinancialReadiness = {
  stage: "invest",
  title: "Prepare seu primeiro investimento",
  description: "Base pronta.",
  ctaLabel: "Começar",
  href: "/investments",
  reasons: [],
  suggestedAmount: 100,
  suggestedAmountLabel: "Aporte",
  confidence: { score: 90, label: "Alta" },
  metrics: {
    monthlyIncome: 5_000,
    monthlyExpenses: 3_000,
    monthlySurplus: 2_000,
    liquidity: 9_000,
    creditDebt: 0,
    reserveTarget: 9_000,
    reserveGap: 0,
    reserveMonths: 3,
    overdueAmount: 0,
    monthsObserved: 3,
  },
};

describe("buildFirstInvestmentGuidance", () => {
  it("bloqueia caminhos quando há contas ou orçamento a organizar", () => {
    const result = buildFirstInvestmentGuidance(
      { ...financial, stage: "economize", href: "/budget", ctaLabel: "Ajustar orçamento" },
      answers,
    );

    expect(result.readiness).toBe("organize");
    expect(result.paths).toEqual([]);
    expect(result.prerequisite?.href).toBe("/budget");
  });

  it("bloqueia produtos enquanto a reserva ou o objetivo ainda estão incompletos", () => {
    const result = buildFirstInvestmentGuidance(
      { ...financial, stage: "protect", href: "/goals", ctaLabel: "Criar meta" },
      answers,
    );

    expect(result.readiness).toBe("protect");
    expect(result.paths).toHaveLength(0);
  });

  it("prioriza liquidez para reserva e perfil sem experiência", () => {
    const result = buildFirstInvestmentGuidance(financial, {
      ...answers,
      objective: "reserve",
      horizonMonths: 6,
      liquidityPreference: "daily",
      fluctuationTolerance: "avoid",
      knowledgeLevel: "none",
    });

    expect(result.profile.riskProfile).toBe("conservative");
    expect(result.paths.map((path) => path.id)).toEqual(["liquid_reserve"]);
  });

  it("oferece no máximo três caminhos e libera diversificação apenas no longo prazo", () => {
    const result = buildFirstInvestmentGuidance(financial, answers);

    expect(result.paths.length).toBeLessThanOrEqual(3);
    expect(result.paths.map((path) => path.id)).toContain("fixed_term");
    expect(result.paths.map((path) => path.id)).toContain("gradual_diversification");
  });

  it("não libera diversificação sem conhecimento ou tolerância", () => {
    const result = buildFirstInvestmentGuidance(financial, {
      ...answers,
      fluctuationTolerance: "avoid",
      knowledgeLevel: "none",
    });

    expect(result.paths.map((path) => path.id)).not.toContain("gradual_diversification");
  });
});
