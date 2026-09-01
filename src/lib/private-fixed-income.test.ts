import { describe, expect, it } from "vitest";

import {
  fixedIncomeTaxRate,
  rankPrivateOffers,
  type PrivateFixedIncomeOffer,
} from "./private-fixed-income";

const base: PrivateFixedIncomeOffer = {
  id: "1",
  institution: "Banco Exemplo",
  conglomerate: "Grupo Exemplo",
  productType: "cdb",
  rateType: "fixed",
  rateValue: 14,
  referenceRate: null,
  minimumInvestment: 1000,
  maturityDate: "2028-09-01",
  dailyLiquidity: false,
  fgcEligible: true,
  sourceUrl: null,
  sourceCheckedAt: "2026-09-01T12:00:00Z",
  notes: null,
  archivedAt: null,
  recordOrigin: "manual",
};
const profile = {
  riskProfile: "conservative",
  horizonMonths: 36,
  liquidityPreference: "long_term",
  objective: "growth",
} as const;

describe("private fixed income comparison", () => {
  it("aplica a tabela regressiva ao CDB e mantém LCI/LCA isentas", () => {
    expect(fixedIncomeTaxRate("cdb", 180)).toBe(0.225);
    expect(fixedIncomeTaxRate("cdb", 500)).toBe(0.175);
    expect(fixedIncomeTaxRate("cdb", 900)).toBe(0.15);
    expect(fixedIncomeTaxRate("lci", 180)).toBe(0);
  });

  it("compara retorno líquido e sinaliza valor acima do FGC", () => {
    const ranked = rankPrivateOffers(
      [base, { ...base, id: "2", productType: "lci", rateValue: 12.5 }],
      profile,
      300_000,
      "2026-09-01",
    );
    expect(ranked[0]?.productType).toBe("lci");
    expect(ranked[0]?.warnings[0]).toContain("R$ 250 mil");
  });

  it("torna inelegível uma oferta abaixo do aporte mínimo", () => {
    const [ranked] = rankPrivateOffers([base], profile, 500, "2026-09-01");
    expect(ranked?.eligible).toBe(false);
    expect(ranked?.score).toBe(0);
  });

  it("não recomenda uma taxa que ultrapassou a janela de conferência", () => {
    const [ranked] = rankPrivateOffers(
      [{ ...base, sourceCheckedAt: "2026-08-01T12:00:00Z" }],
      profile,
      10_000,
      "2026-09-01",
      7,
    );
    expect(ranked?.fresh).toBe(false);
    expect(ranked?.eligible).toBe(false);
    expect(ranked?.warnings[0]).toContain("confirme novamente");
  });
});
