export type MaturityPosition = {
  id: string;
  ticker: string;
  name: string;
  marketValue: number;
  maturityDate: string | null;
};

export type MaturityItem = MaturityPosition & {
  daysUntilMaturity: number;
  status: "overdue" | "upcoming" | "future";
};

export type MaturityBucket = {
  id: "overdue" | "days_30" | "days_90" | "days_180" | "later";
  label: string;
  total: number;
  count: number;
};

export type MaturityLadder = {
  buckets: MaturityBucket[];
  items: MaturityItem[];
  nextMaturity: MaturityItem | null;
  totalWithMaturity: number;
};

function dayNumber(value: string) {
  return Math.floor(new Date(`${value}T12:00:00Z`).getTime() / 86_400_000);
}

export function buildMaturityLadder(
  positions: MaturityPosition[],
  referenceDate: string,
  alertDays = 30,
): MaturityLadder {
  const reference = dayNumber(referenceDate);
  const items = positions
    .filter((position): position is MaturityPosition & { maturityDate: string } =>
      Boolean(position.maturityDate),
    )
    .map((position): MaturityItem => {
      const daysUntilMaturity = dayNumber(position.maturityDate) - reference;
      return {
        ...position,
        daysUntilMaturity,
        status:
          daysUntilMaturity < 0
            ? "overdue"
            : daysUntilMaturity <= alertDays
              ? "upcoming"
              : "future",
      };
    })
    .sort((left, right) => left.daysUntilMaturity - right.daysUntilMaturity);

  const definitions: Array<{
    id: MaturityBucket["id"];
    label: string;
    matches: (days: number) => boolean;
  }> = [
    { id: "overdue", label: "Vencidos", matches: (days) => days < 0 },
    { id: "days_30", label: "Até 30 dias", matches: (days) => days >= 0 && days <= 30 },
    { id: "days_90", label: "31–90 dias", matches: (days) => days > 30 && days <= 90 },
    { id: "days_180", label: "91–180 dias", matches: (days) => days > 90 && days <= 180 },
    { id: "later", label: "Após 180 dias", matches: (days) => days > 180 },
  ];
  const buckets = definitions.map(({ id, label, matches }) => {
    const matching = items.filter((item) => matches(item.daysUntilMaturity));
    return {
      id,
      label,
      count: matching.length,
      total: matching.reduce((sum, item) => sum + Math.max(0, item.marketValue), 0),
    };
  });

  return {
    buckets,
    items,
    nextMaturity: items.find((item) => item.daysUntilMaturity >= 0) ?? null,
    totalWithMaturity: items.reduce((sum, item) => sum + Math.max(0, item.marketValue), 0),
  };
}
