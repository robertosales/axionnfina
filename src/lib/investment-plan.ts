import type {
  InvestmentRadarResponse,
  MarketIndicator,
  RankedOpportunity,
  RiskProfile,
} from "./investment-radar";

export type InvestmentPlanInput = {
  initialAmount: number;
  monthlyContribution: number;
  horizonMonths: number;
};

export type InvestmentPlanAllocation = {
  opportunityId: string;
  name: string;
  weight: number;
  initialAmount: number;
  monthlyAmount: number;
  annualRate: number;
  rateLabel: string;
  reason: string;
};

export type InvestmentPlanScenario = {
  id: "cautious" | "reference" | "optimistic";
  label: string;
  annualRate: number;
  grossValue: number;
  estimatedNetValue: number;
  estimatedEarnings: number;
};

export type InvestmentPlanSimulation = {
  input: InvestmentPlanInput;
  allocations: InvestmentPlanAllocation[];
  scenarios: InvestmentPlanScenario[];
  totalContributed: number;
  weightedAnnualRate: number;
  estimatedTaxRate: number;
  estimatedCustodyRate: number;
  assumptions: string[];
};

export type SavedInvestmentPlan = {
  id: string;
  name: string;
  input: InvestmentPlanInput;
  allocations: InvestmentPlanAllocation[];
  scenarios: InvestmentPlanScenario[];
  marketReferenceDate: string;
  profileSnapshot: InvestmentRadarResponse["profile"];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function indicatorValue(indicators: MarketIndicator[], id: MarketIndicator["id"]): number | null {
  return indicators.find((indicator) => indicator.id === id)?.value ?? null;
}

export function estimateOpportunityAnnualRate(
  opportunity: RankedOpportunity,
  indicators: MarketIndicator[],
): number | null {
  if (opportunity.indexer === "fixed") return opportunity.purchaseRate;
  if (opportunity.indexer === "selic") {
    const selic = indicatorValue(indicators, "selic");
    return selic == null ? null : Math.max(0, selic + opportunity.purchaseRate);
  }
  if (opportunity.indexer === "ipca") {
    const ipca = indicatorValue(indicators, "ipca12m");
    return ipca == null
      ? null
      : ((1 + ipca / 100) * (1 + opportunity.purchaseRate / 100) - 1) * 100;
  }
  return null;
}

function allocationWeights(count: number, profile: RiskProfile): number[] {
  if (count <= 1) return [1];
  if (count === 2) return profile === "aggressive" ? [0.55, 0.45] : [0.65, 0.35];
  if (profile === "conservative") return [0.6, 0.3, 0.1];
  if (profile === "aggressive") return [0.4, 0.35, 0.25];
  return [0.5, 0.3, 0.2];
}

function chooseOpportunities(radar: InvestmentRadarResponse): RankedOpportunity[] {
  const withRate = radar.opportunities.filter(
    (opportunity) =>
      opportunity.fit !== "low" &&
      estimateOpportunityAnnualRate(opportunity, radar.indicators) != null,
  );
  const candidates = withRate.length > 0 ? withRate : radar.opportunities;
  const objective = radar.profile.objective;

  if (objective === "reserve") {
    const selic = candidates.find((opportunity) => opportunity.indexer === "selic");
    return selic ? [selic] : candidates.slice(0, 1);
  }

  const preferred = candidates.filter((opportunity) => {
    if (objective === "retirement") {
      return /renda\+/i.test(opportunity.name) || opportunity.indexer === "ipca";
    }
    if (objective === "education") {
      return /educa\+/i.test(opportunity.name) || opportunity.indexer === "ipca";
    }
    return true;
  });
  const pool = preferred.length >= 2 ? preferred : candidates;
  const selected: RankedOpportunity[] = [];

  for (const opportunity of pool) {
    if (selected.length >= 3) break;
    if (selected.length === 0 || !selected.some((item) => item.indexer === opportunity.indexer)) {
      selected.push(opportunity);
    }
  }
  for (const opportunity of pool) {
    if (selected.length >= 3) break;
    if (!selected.some((item) => item.id === opportunity.id)) selected.push(opportunity);
  }
  return selected;
}

function projectionTaxRate(horizonMonths: number): number {
  if (horizonMonths <= 6) return 0.225;
  if (horizonMonths <= 12) return 0.2;
  if (horizonMonths <= 24) return 0.175;
  return 0.15;
}

function monthsBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`).getTime();
  const end = new Date(`${to}T12:00:00Z`).getTime();
  return Math.max(0, Math.ceil((end - start) / 2_629_746_000));
}

function opportunityCustodyRate(
  opportunity: RankedOpportunity,
  allocatedPrincipal: number,
  horizonMonths: number,
): number {
  if (opportunity.indexer === "selic") {
    if (allocatedPrincipal <= 10_000) return 0;
    return 0.2 * ((allocatedPrincipal - 10_000) / allocatedPrincipal);
  }
  const heldToMaturity =
    horizonMonths >= monthsBetween(opportunity.referenceDate, opportunity.maturityDate);
  if (heldToMaturity && /renda\+|educa\+/i.test(opportunity.name)) return 0;
  return 0.2;
}

function futureValue(input: InvestmentPlanInput, annualRate: number): number {
  const monthlyRate = (1 + Math.max(annualRate, 0) / 100) ** (1 / 12) - 1;
  const initialFuture = input.initialAmount * (1 + monthlyRate) ** input.horizonMonths;
  if (monthlyRate === 0) {
    return initialFuture + input.monthlyContribution * input.horizonMonths;
  }
  const contributionsFuture =
    input.monthlyContribution * (((1 + monthlyRate) ** input.horizonMonths - 1) / monthlyRate);
  return initialFuture + contributionsFuture;
}

function reasonFor(opportunity: RankedOpportunity, rank: number): string {
  if (opportunity.indexer === "selic") return "Base de liquidez e menor oscilação de preço.";
  if (/renda\+/i.test(opportunity.name))
    return "Fluxo futuro alinhado ao objetivo de aposentadoria.";
  if (/educa\+/i.test(opportunity.name)) return "Fluxo futuro alinhado ao objetivo de educação.";
  if (opportunity.indexer === "ipca") return "Proteção do poder de compra no horizonte planejado.";
  return rank === 0
    ? "Maior aderência ao perfil atual."
    : "Diversificação entre indexadores e prazos.";
}

export function simulateInvestmentPlan(
  radar: InvestmentRadarResponse,
  input: InvestmentPlanInput,
): InvestmentPlanSimulation {
  const normalizedInput = {
    initialAmount: Math.max(0, input.initialAmount),
    monthlyContribution: Math.max(0, input.monthlyContribution),
    horizonMonths: Math.min(600, Math.max(1, Math.round(input.horizonMonths))),
  };
  const selected = chooseOpportunities(radar);
  const weights = allocationWeights(selected.length, radar.profile.riskProfile);
  const allocations = selected
    .map((opportunity, index): InvestmentPlanAllocation | null => {
      const annualRate = estimateOpportunityAnnualRate(opportunity, radar.indicators);
      if (annualRate == null) return null;
      const weight = weights[index] ?? 0;
      return {
        opportunityId: opportunity.id,
        name: opportunity.name,
        weight,
        initialAmount: normalizedInput.initialAmount * weight,
        monthlyAmount: normalizedInput.monthlyContribution * weight,
        annualRate,
        rateLabel: opportunity.rateLabel,
        reason: reasonFor(opportunity, index),
      };
    })
    .filter((allocation): allocation is InvestmentPlanAllocation => allocation != null);

  const totalWeight = allocations.reduce((sum, allocation) => sum + allocation.weight, 0);
  const normalizedAllocations = allocations.map((allocation) => {
    const weight = totalWeight > 0 ? allocation.weight / totalWeight : 0;
    return {
      ...allocation,
      weight,
      initialAmount: normalizedInput.initialAmount * weight,
      monthlyAmount: normalizedInput.monthlyContribution * weight,
    };
  });
  const weightedAnnualRate = normalizedAllocations.reduce(
    (sum, allocation) => sum + allocation.annualRate * allocation.weight,
    0,
  );
  const totalContributed =
    normalizedInput.initialAmount +
    normalizedInput.monthlyContribution * normalizedInput.horizonMonths;
  const estimatedTaxRate = projectionTaxRate(normalizedInput.horizonMonths);
  const selectedById = new Map(selected.map((opportunity) => [opportunity.id, opportunity]));
  const estimatedCustodyRate = normalizedAllocations.reduce((sum, allocation) => {
    const opportunity = selectedById.get(allocation.opportunityId);
    if (!opportunity) return sum;
    return (
      sum +
      opportunityCustodyRate(
        opportunity,
        totalContributed * allocation.weight,
        normalizedInput.horizonMonths,
      ) *
        allocation.weight
    );
  }, 0);
  const scenarioSpecs = [
    { id: "cautious" as const, label: "Cauteloso", delta: -2 },
    { id: "reference" as const, label: "Referência", delta: 0 },
    { id: "optimistic" as const, label: "Favorável", delta: 2 },
  ];
  const scenarios = scenarioSpecs.map((scenario): InvestmentPlanScenario => {
    const annualRate = Math.max(0, weightedAnnualRate + scenario.delta - estimatedCustodyRate);
    const grossValue = futureValue(normalizedInput, annualRate);
    const grossEarnings = Math.max(0, grossValue - totalContributed);
    const estimatedNetValue = grossValue - grossEarnings * estimatedTaxRate;
    return {
      id: scenario.id,
      label: scenario.label,
      annualRate,
      grossValue,
      estimatedNetValue,
      estimatedEarnings: Math.max(0, estimatedNetValue - totalContributed),
    };
  });

  return {
    input: normalizedInput,
    allocations: normalizedAllocations,
    scenarios,
    totalContributed,
    weightedAnnualRate,
    estimatedTaxRate,
    estimatedCustodyRate,
    assumptions: [
      "Taxas atuais mantidas apenas como hipótese de cálculo; aportes futuros terão taxas diferentes.",
      `Custódia média estimada em ${estimatedCustodyRate.toFixed(2)}% a.a., considerando as isenções gerais conhecidas do Tesouro Selic, RendA+ e Educa+.`,
      "IR estimado pela faixa do prazo total; aportes mensais podem cair em faixas diferentes.",
      "A projeção não inclui IOF, inflação futura, taxas da instituição ou venda antecipada.",
    ],
  };
}
