import { describe, expect, it } from "vitest";

import {
  parseLatestTreasuryCsv,
  rankTreasuryOpportunities,
  type InvestmentProfile,
} from "./investment-radar";

const CSV = `Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
Tesouro Selic;01/03/2029;28/08/2026;0,03;0,04;19759,60;19744,43;19744,43
Tesouro Prefixado;01/01/2032;28/08/2026;14,49;14,61;488,02;485,05;485,05
Tesouro IPCA+;15/05/2045;28/08/2026;7,29;7,41;1280,52;1254,17;1254,17
Tesouro Selic;01/03/2029;27/08/2026;0,03;0,04;19749,38;19734,19;19734,19`;

describe("investment radar", () => {
  it("lê apenas o bloco mais recente do CSV oficial", () => {
    const opportunities = parseLatestTreasuryCsv(CSV);

    expect(opportunities).toHaveLength(3);
    expect(opportunities[0]).toMatchObject({
      indexer: "selic",
      referenceDate: "2026-08-28",
      purchaseRate: 0.03,
      purchasePrice: 19759.6,
    });
  });

  it("prioriza Tesouro Selic para reserva conservadora com liquidez diária", () => {
    const profile: InvestmentProfile = {
      riskProfile: "conservative",
      horizonMonths: 24,
      liquidityPreference: "daily",
      objective: "reserve",
    };
    const ranked = rankTreasuryOpportunities(parseLatestTreasuryCsv(CSV), profile, []);

    expect(ranked[0]?.indexer).toBe("selic");
    expect(ranked[0]?.fit).toBe("high");
    expect(ranked.at(-1)?.indexer).toBe("ipca");
  });

  it("favorece IPCA longo para aposentadoria agressiva", () => {
    const profile: InvestmentProfile = {
      riskProfile: "aggressive",
      horizonMonths: 240,
      liquidityPreference: "long_term",
      objective: "retirement",
    };
    const ranked = rankTreasuryOpportunities(parseLatestTreasuryCsv(CSV), profile, []);

    expect(ranked[0]?.indexer).toBe("ipca");
  });

  it("considera o prazo da meta mais próxima fora da aposentadoria", () => {
    const ranked = rankTreasuryOpportunities(
      parseLatestTreasuryCsv(CSV),
      {
        riskProfile: "moderate",
        horizonMonths: 240,
        liquidityPreference: "up_to_1_year",
        objective: "growth",
      },
      [],
      { reserveMonths: 6, monthlyExpenses: 2_000, liquidBalance: 12_000, nearestGoalMonths: 12 },
    );

    expect(ranked[0]?.indexer).toBe("selic");
    expect(ranked.find((item) => item.indexer === "ipca")?.evidence).toContainEqual(
      expect.objectContaining({ label: "Prazo", impact: "warning" }),
    );
  });
});
