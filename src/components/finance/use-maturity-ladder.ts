import { useMemo } from "react";
import { localDateInput } from "@/lib/financial-input";
import { useInvestmentAlertPreferences, type Position } from "@/lib/finance-data";
import { buildMaturityLadder } from "@/lib/investment-maturity";

export function useMaturityLadder(positions: Position[]) {
  const preferences = useInvestmentAlertPreferences();

  const fixedIncome = useMemo(
    () => positions.filter((position) => position.assetClass === "fixed_income"),
    [positions],
  );

  const missingMaturity = useMemo(
    () => fixedIncome.filter((position) => !position.maturityDate),
    [fixedIncome],
  );

  const referenceDate = localDateInput();

  const ladder = useMemo(
    () =>
      buildMaturityLadder(
        fixedIncome,
        referenceDate,
        preferences.data?.maturityAlertDays ?? 30,
      ),
    [fixedIncome, referenceDate, preferences.data?.maturityAlertDays],
  );

  const events = useMemo(() => ladder.items.slice(0, 5), [ladder.items]);
  const maximum = useMemo(
    () => Math.max(...ladder.buckets.map((bucket) => bucket.total), 1),
    [ladder.buckets],
  );

  return {
    preferences,
    fixedIncome,
    missingMaturity,
    ladder,
    events,
    maximum,
  };
}
