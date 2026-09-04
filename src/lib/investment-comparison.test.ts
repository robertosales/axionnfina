import { describe, expect, it } from "vitest";

import { buildInvestmentComparison } from "./investment-comparison";
import type { RankedOpportunity } from "./investment-radar";
import type { RankedPrivateOffer } from "./private-fixed-income";

const treasury: RankedOpportunity = {
  id: "td-1",
  name: "Tesouro Selic 2029",
  issuer: "Tesouro Nacional",
  indexer: "selic",
  maturityDate: "2029-03-01",
  referenceDate: "2026-09-01",
  purchaseRate: 0.03,
  purchasePrice: 100,
  minimumInvestment: 30,
  liquidityDays: 0,
  riskLevel: 1,
  hasCoupons: false,
  source: "Tesouro Transparente",
  sourceUrl: "https://www.tesourotransparente.gov.br/dados",
  score: 90,
  fit: "high",
  rateLabel: "Selic + 0,03%",
  summary: "Aderente",
  evidence: [],
  warnings: [],
};

const privateOffer: RankedPrivateOffer = {
  id: "private-1",
  institution: "Banco Exemplo",
  conglomerate: "Grupo Exemplo",
  productType: "cdb",
  rateType: "cdi",
  rateValue: 100,
  referenceRate: 14,
  minimumInvestment: 100,
  maturityDate: "2028-09-01",
  dailyLiquidity: true,
  fgcEligible: true,
  sourceUrl: "https://banco.example/oferta",
  sourceCheckedAt: "2026-09-01T12:00:00Z",
  notes: null,
  archivedAt: null,
  recordOrigin: "manual",
  grossAnnualRate: 0.14,
  netAnnualRate: 0.1155,
  incomeTaxRate: 0.175,
  daysToMaturity: 730,
  projectedNetValue: 12_000,
  score: 80,
  eligible: true,
  fresh: true,
  sourceAgeDays: 0,
  warnings: [],
};

describe("buildInvestmentComparison", () => {
  it("combina fontes públicas e privadas sem chamar uma opção de melhor", () => {
    const result = buildInvestmentComparison([treasury], [privateOffer]);

    expect(result).toHaveLength(2);
    expect(result.every((item) => !item.fitLabel.toLowerCase().includes("melhor"))).toBe(true);
    expect(result.find((item) => item.origin === "treasury")?.source.status).toBe("verified");
  });

  it("não compara oferta privada sem URL verificável", () => {
    const [result] = buildInvestmentComparison([], [{ ...privateOffer, sourceUrl: null }]);

    expect(result?.comparable).toBe(false);
    expect(result?.source.status).toBe("incomplete");
    expect(result?.estimate).toBeNull();
  });

  it("marca oferta antiga como vencida", () => {
    const [result] = buildInvestmentComparison([], [{ ...privateOffer, fresh: false }]);

    expect(result?.comparable).toBe(false);
    expect(result?.source.status).toBe("stale");
  });

  it("expõe custos, tributos, liquidez, risco e proteção", () => {
    const [result] = buildInvestmentComparison([treasury], []);

    expect(result).toMatchObject({
      costs: expect.any(String),
      taxes: expect.any(String),
      liquidity: expect.any(String),
      risk: expect.any(String),
      protection: expect.any(String),
    });
  });
});
