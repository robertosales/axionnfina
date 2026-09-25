/**
 * Investment Domain - Regras de negócio de investimentos puras
 */

// Algoritmos
export { buildInvestmentRadar } from "@/lib/investment-radar";
export { buildInvestmentAlerts } from "@/lib/investment-alerts";
export { buildInvestmentMaturityLadder } from "@/lib/investment-maturity";
export { calculateInvestmentProgress } from "@/lib/investment-progress";
export { simulateInvestmentPlan } from "@/lib/investment-plan";
export { compareInvestments } from "@/lib/investment-comparison";
export { generateInvestmentBriefing } from "@/lib/investment-briefing";
export { normalizeInvestmentPositions } from "@/lib/investment-import";
export { rankEquityOpportunities } from "@/lib/equity-ranking";
export { analyzePrivateFixedIncome } from "@/lib/private-fixed-income";
export { generateFirstInvestmentGuide } from "@/lib/first-investment-guide";

// Tipos e constantes
export type {
  InvestmentRadarResult,
  InvestmentAlert,
  InvestmentMaturityEntry,
  InvestmentProgress,
  InvestmentPlan,
  InvestmentComparison,
  EquityRanking,
  PrivateFixedIncomeAnalysis,
} from "@/lib/investment-radar";

// Market data (tipos e constantes apenas)
export { MARKET_EQUITIES } from "@/lib/market-equities";
export type { MarketEquity, EquityType } from "@/lib/market-equities";
