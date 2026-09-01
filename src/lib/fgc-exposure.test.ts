import { describe, expect, it } from "vitest";

import { calculateFgcExposure } from "./fgc-exposure";

describe("calculateFgcExposure", () => {
  it("consolida instituições do mesmo conglomerado", () => {
    const summary = calculateFgcExposure([
      { id: "1", name: "CDB A", marketValue: 120_000, conglomerate: "Grupo A", fgcEligible: true },
      { id: "2", name: "LCI B", marketValue: 90_000, conglomerate: "grupo a", fgcEligible: true },
    ]);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]?.currentExposure).toBe(210_000);
    expect(summary.groups[0]?.status).toBe("attention");
  });

  it("projeta parcela descoberta após um novo aporte", () => {
    const summary = calculateFgcExposure(
      [{ id: "1", name: "CDB", marketValue: 230_000, conglomerate: "Grupo A", fgcEligible: true }],
      { conglomerate: "Grupo A", amount: 50_000 },
    );
    expect(summary.groups[0]?.uncoveredAmount).toBe(30_000);
    expect(summary.groups[0]?.status).toBe("exceeded");
  });

  it("separa posições elegíveis sem conglomerado", () => {
    const summary = calculateFgcExposure([
      { id: "1", name: "CDB", marketValue: 20_000, conglomerate: null, fgcEligible: true },
      { id: "2", name: "Tesouro", marketValue: 30_000, conglomerate: null, fgcEligible: false },
    ]);
    expect(summary.unclassifiedAmount).toBe(20_000);
    expect(summary.totalEligibleExposure).toBe(0);
  });
});
