export const FGC_ORDINARY_LIMIT = 250_000;

export type FgcPosition = {
  id: string;
  name: string;
  marketValue: number;
  conglomerate: string | null;
  fgcEligible: boolean | null;
};

export type PlannedFgcAllocation = {
  conglomerate: string;
  amount: number;
};

export type FgcExposureGroup = {
  conglomerate: string;
  currentExposure: number;
  plannedAmount: number;
  projectedExposure: number;
  coveredAmount: number;
  uncoveredAmount: number;
  remainingMargin: number;
  utilization: number;
  status: "safe" | "attention" | "exceeded";
  positionIds: string[];
};

export type FgcExposureSummary = {
  groups: FgcExposureGroup[];
  unclassifiedAmount: number;
  totalEligibleExposure: number;
  projectedUncoveredAmount: number;
};

function key(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function calculateFgcExposure(
  positions: FgcPosition[],
  planned?: PlannedFgcAllocation,
): FgcExposureSummary {
  const grouped = new Map<
    string,
    { conglomerate: string; currentExposure: number; positionIds: string[] }
  >();
  let unclassifiedAmount = 0;

  for (const position of positions) {
    if (position.fgcEligible !== true) continue;
    const value = Math.max(0, position.marketValue);
    if (!position.conglomerate?.trim()) {
      unclassifiedAmount += value;
      continue;
    }
    const groupKey = key(position.conglomerate);
    const group = grouped.get(groupKey) ?? {
      conglomerate: position.conglomerate.trim(),
      currentExposure: 0,
      positionIds: [],
    };
    group.currentExposure += value;
    group.positionIds.push(position.id);
    grouped.set(groupKey, group);
  }

  if (planned && planned.amount > 0) {
    const groupKey = key(planned.conglomerate);
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        conglomerate: planned.conglomerate.trim(),
        currentExposure: 0,
        positionIds: [],
      });
    }
  }

  const groups = [...grouped.entries()]
    .map(([groupKey, group]): FgcExposureGroup => {
      const plannedAmount = planned && key(planned.conglomerate) === groupKey ? planned.amount : 0;
      const projectedExposure = group.currentExposure + plannedAmount;
      const utilization = projectedExposure / FGC_ORDINARY_LIMIT;
      return {
        ...group,
        plannedAmount,
        projectedExposure,
        coveredAmount: Math.min(FGC_ORDINARY_LIMIT, projectedExposure),
        uncoveredAmount: Math.max(0, projectedExposure - FGC_ORDINARY_LIMIT),
        remainingMargin: Math.max(0, FGC_ORDINARY_LIMIT - projectedExposure),
        utilization,
        status: utilization > 1 ? "exceeded" : utilization >= 0.8 ? "attention" : "safe",
      };
    })
    .sort((left, right) => right.projectedExposure - left.projectedExposure);

  return {
    groups,
    unclassifiedAmount,
    totalEligibleExposure: groups.reduce((sum, group) => sum + group.currentExposure, 0),
    projectedUncoveredAmount: groups.reduce((sum, group) => sum + group.uncoveredAmount, 0),
  };
}
