import { describe, expect, it } from "vitest";

import { shouldCreateRadarAlert } from "./investment-alerts";

const preferences = {
  enabled: true,
  inAppEnabled: true,
  minimumScore: 70,
  scoreChangeThreshold: 5,
};

describe("shouldCreateRadarAlert", () => {
  it("notifica na primeira oportunidade elegível", () => {
    expect(shouldCreateRadarAlert(preferences, { id: "selic", score: 81 }, null)).toBe(true);
  });

  it("não repete quando o líder e a pontuação permanecem estáveis", () => {
    expect(
      shouldCreateRadarAlert(
        preferences,
        { id: "selic", score: 81 },
        {
          topOpportunityId: "selic",
          topScore: 79,
        },
      ),
    ).toBe(false);
  });

  it("notifica quando muda o líder ou a pontuação cruza o limite", () => {
    expect(
      shouldCreateRadarAlert(
        preferences,
        { id: "ipca", score: 81 },
        {
          topOpportunityId: "selic",
          topScore: 81,
        },
      ),
    ).toBe(true);
    expect(
      shouldCreateRadarAlert(
        preferences,
        { id: "selic", score: 84 },
        {
          topOpportunityId: "selic",
          topScore: 79,
        },
      ),
    ).toBe(true);
  });

  it("respeita desligamento e pontuação mínima", () => {
    expect(
      shouldCreateRadarAlert({ ...preferences, enabled: false }, { id: "selic", score: 90 }, null),
    ).toBe(false);
    expect(shouldCreateRadarAlert(preferences, { id: "selic", score: 69 }, null)).toBe(false);
  });
});
