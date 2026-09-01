import type { SavedInvestmentPlan } from "./investment-plan";

export type PortfolioPosition = {
  id: string;
  ticker: string;
  name: string;
  marketValue: number;
};

export type InvestmentProgressLine = {
  opportunityId: string;
  name: string;
  targetWeight: number;
  actualWeight: number;
  actualValue: number;
  driftPercentagePoints: number;
  suggestedContribution: number;
  matchedPositionIds: string[];
};

export type InvestmentPlanProgress = {
  planId: string;
  planName: string;
  actualTotal: number;
  targetMonthlyContribution: number;
  overallDrift: number;
  unmatchedWeight: number;
  status: "aligned" | "attention" | "off_track";
  lines: InvestmentProgressLine[];
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(allocationName: string, position: PortfolioPosition): number {
  const target = normalize(allocationName);
  const name = normalize(position.name);
  const ticker = normalize(position.ticker);
  if (target === name || target === ticker) return 100;
  if (ticker.length >= 4 && target.includes(ticker)) return 85;
  if (name.length >= 6 && (target.includes(name) || name.includes(target))) return 75;

  const targetWords = new Set(target.split(" ").filter((word) => word.length >= 4));
  const positionWords = new Set(name.split(" ").filter((word) => word.length >= 4));
  if (targetWords.size === 0 || positionWords.size === 0) return 0;
  const common = [...targetWords].filter((word) => positionWords.has(word)).length;
  return (common / Math.max(targetWords.size, positionWords.size)) * 60;
}

export function calculateInvestmentPlanProgress(
  plan: SavedInvestmentPlan,
  positions: PortfolioPosition[],
): InvestmentPlanProgress {
  const actualTotal = positions.reduce(
    (sum, position) => sum + Math.max(0, position.marketValue),
    0,
  );
  const values = new Map(plan.allocations.map((allocation) => [allocation.opportunityId, 0]));
  const matches = new Map(
    plan.allocations.map((allocation) => [allocation.opportunityId, [] as string[]]),
  );
  let unmatchedValue = 0;

  for (const position of positions) {
    const best = plan.allocations
      .map((allocation) => ({ allocation, score: matchScore(allocation.name, position) }))
      .sort((a, b) => b.score - a.score)[0];
    const value = Math.max(0, position.marketValue);
    if (!best || best.score < 40) {
      unmatchedValue += value;
      continue;
    }
    values.set(
      best.allocation.opportunityId,
      (values.get(best.allocation.opportunityId) ?? 0) + value,
    );
    matches.get(best.allocation.opportunityId)?.push(position.id);
  }

  const preliminary = plan.allocations.map((allocation) => {
    const actualValue = values.get(allocation.opportunityId) ?? 0;
    const actualWeight = actualTotal > 0 ? actualValue / actualTotal : 0;
    return {
      allocation,
      actualValue,
      actualWeight,
      deficit: Math.max(0, allocation.weight - actualWeight),
    };
  });
  const totalDeficit = preliminary.reduce((sum, line) => sum + line.deficit, 0);
  const lines: InvestmentProgressLine[] = preliminary.map(
    ({ allocation, actualValue, actualWeight, deficit }) => ({
      opportunityId: allocation.opportunityId,
      name: allocation.name,
      targetWeight: allocation.weight,
      actualWeight,
      actualValue,
      driftPercentagePoints: (actualWeight - allocation.weight) * 100,
      suggestedContribution:
        totalDeficit > 0 ? plan.input.monthlyContribution * (deficit / totalDeficit) : 0,
      matchedPositionIds: matches.get(allocation.opportunityId) ?? [],
    }),
  );
  const unmatchedWeight = actualTotal > 0 ? unmatchedValue / actualTotal : 0;
  const overallDrift =
    (lines.reduce(
      (sum, line) => sum + Math.abs(line.actualWeight - line.targetWeight),
      unmatchedWeight,
    ) /
      2) *
    100;
  const status = overallDrift <= 5 ? "aligned" : overallDrift <= 15 ? "attention" : "off_track";

  return {
    planId: plan.id,
    planName: plan.name,
    actualTotal,
    targetMonthlyContribution: plan.input.monthlyContribution,
    overallDrift: Math.round(overallDrift * 10) / 10,
    unmatchedWeight,
    status,
    lines,
  };
}
