import { describe, expect, it } from "vitest";

import { buildInvestmentBriefing } from "./investment-briefing";

const emptyInput = {
  fgc: { groups: [], unclassifiedAmount: 0, totalEligibleExposure: 0, projectedUncoveredAmount: 0 },
  maturities: { buckets: [], items: [], nextMaturity: null, totalWithMaturity: 0 },
  planProgress: [],
  missingMetadataCount: 0,
};

describe("buildInvestmentBriefing", () => {
  it("prioriza vencido antes de oportunidade", () => {
    const actions = buildInvestmentBriefing({
      ...emptyInput,
      maturities: {
        ...emptyInput.maturities,
        items: [
          {
            id: "1",
            ticker: "CDB",
            name: "CDB",
            marketValue: 1000,
            maturityDate: "2026-08-30",
            daysUntilMaturity: -2,
            status: "overdue",
          },
        ],
      },
      topPublicOpportunity: { id: "tesouro", score: 90, name: "Tesouro Selic" } as never,
    });
    expect(actions[0]?.id).toBe("maturity-overdue");
    expect(actions.at(-1)?.priority).toBe("opportunity");
  });

  it("mostra concentração acima do limite como crítica", () => {
    const actions = buildInvestmentBriefing({
      ...emptyInput,
      fgc: {
        ...emptyInput.fgc,
        groups: [
          {
            conglomerate: "Grupo A",
            currentExposure: 280000,
            plannedAmount: 0,
            projectedExposure: 280000,
            coveredAmount: 250000,
            uncoveredAmount: 30000,
            remainingMargin: 0,
            utilization: 1.12,
            status: "exceeded",
            positionIds: [],
          },
        ],
      },
    });
    expect(actions[0]?.priority).toBe("critical");
    expect(actions[0]?.metric).toContain("30.000");
  });

  it("retorna fila vazia quando não há risco nem oportunidade", () => {
    expect(buildInvestmentBriefing(emptyInput)).toEqual([]);
  });
});
