import { describe, expect, it } from "vitest";

import { buildMarketOverview, rankEquityOpportunities } from "./equity-ranking";
import { CURATED_ASSETS, type EquityQuote } from "./market-equities";
import type { InvestmentProfile, InvestmentRadarContext } from "./investment-radar";

const quote: EquityQuote = {
  ticker: "BOVA11",
  price: 180,
  changePercent: 0.7,
  change12mPercent: 12.5,
  fiftyTwoWeekLow: 137,
  fiftyTwoWeekHigh: 195,
  referenceDate: "2026-09-17",
  source: "Yahoo Finance (B3)",
  sourceUrl: "https://finance.yahoo.com/quote/BOVA11.SA",
};

const quotes = new Map([[quote.ticker, quote]]);

const readyContext: InvestmentRadarContext = {
  reserveMonths: 8,
  monthlyExpenses: 4000,
  liquidBalance: 32_000,
  nearestGoalMonths: null,
};

const growthProfile: InvestmentProfile = {
  riskProfile: "moderate",
  horizonMonths: 72,
  liquidityPreference: "long_term",
  objective: "growth",
};

describe("rankEquityOpportunities", () => {
  it("bloqueia renda variável para estudo quando não há reserva formada", () => {
    const ranked = rankEquityOpportunities(CURATED_ASSETS, quotes, growthProfile, {
      ...readyContext,
      reserveMonths: 1,
    });

    expect(ranked.every((item) => item.studyOnly)).toBe(true);
    expect(ranked[0]?.studyReason).toContain("reserva de emergência");
  });

  it("bloqueia quando o objetivo declarado é reserva de emergência", () => {
    const ranked = rankEquityOpportunities(CURATED_ASSETS, quotes, {
      ...growthProfile,
      objective: "reserve",
    }, readyContext);

    expect(ranked.every((item) => item.studyOnly)).toBe(true);
  });

  it("libera ETF de índice para perfil moderado com prazo longo e reserva formada", () => {
    const ranked = rankEquityOpportunities(CURATED_ASSETS, quotes, growthProfile, readyContext);
    const bova = ranked.find((item) => item.ticker === "BOVA11");

    expect(bova?.studyOnly).toBe(false);
    expect(bova?.score).toBeGreaterThan(50);
    expect(bova?.quote?.price).toBe(180);
  });

  it("mantém prazo curto fora do destaque", () => {
    const ranked = rankEquityOpportunities(CURATED_ASSETS, quotes, {
      ...growthProfile,
      horizonMonths: 12,
    }, readyContext);

    expect(ranked.every((item) => item.studyOnly)).toBe(true);
  });

  it("não usa desempenho passado como critério de pontuação", () => {
    const base = rankEquityOpportunities(CURATED_ASSETS, quotes, growthProfile, readyContext);
    const inverted = rankEquityOpportunities(
      CURATED_ASSETS,
      new Map([[quote.ticker, { ...quote, change12mPercent: -35 }]]),
      growthProfile,
      readyContext,
    );

    expect(inverted.find((item) => item.ticker === "BOVA11")?.score).toBe(
      base.find((item) => item.ticker === "BOVA11")?.score,
    );
  });

  it("sempre alerta ausência de FGC e risco de oscilação", () => {
    const ranked = rankEquityOpportunities(CURATED_ASSETS, quotes, growthProfile, readyContext);

    expect(ranked.every((item) => item.warnings.some((w) => w.includes("FGC")))).toBe(true);
  });
});

describe("buildMarketOverview", () => {
  it("resume o dia sem inventar número ausente", () => {
    const overview = buildMarketOverview(
      [
        { id: "ibovespa", label: "Ibovespa", value: null, changePercent: null, unit: "pontos" },
        { id: "usdbrl", label: "Dólar comercial", value: 5.4, changePercent: -0.3, unit: "R$" },
      ],
      "2026-09-17",
      "Yahoo Finance",
      "https://finance.yahoo.com",
    );

    expect(overview.summary).toContain("Não foi possível confirmar");
    expect(overview.indices[0]?.value).toBeNull();
  });
});
