import { useEffect, useMemo, useState } from "react";
import {
  useInvestmentAlertPreferences,
  usePrivateFixedIncomeOffers,
  type Position,
} from "@/lib/finance-data";
import { calculateFgcExposure } from "@/lib/fgc-exposure";

export function useFgcExposure(positions: Position[]) {
  const offers = usePrivateFixedIncomeOffers(false);
  const preferences = useInvestmentAlertPreferences();
  const [selectedOfferId, setSelectedOfferId] = useState("");

  const eligibleOffers = useMemo(
    () => (offers.data ?? []).filter((offer) => offer.fgcEligible),
    [offers.data],
  );

  useEffect(() => {
    if (!selectedOfferId && eligibleOffers[0]) setSelectedOfferId(eligibleOffers[0].id);
  }, [eligibleOffers, selectedOfferId]);

  const selectedOffer = eligibleOffers.find((offer) => offer.id === selectedOfferId);
  const plannedAmount = preferences.data?.privateComparisonAmount ?? 10_000;

  const summary = useMemo(
    () =>
      calculateFgcExposure(
        positions.map((position) => ({
          id: position.id,
          name: position.name,
          marketValue: position.marketValue,
          conglomerate: position.conglomerate,
          fgcEligible: position.fgcEligible,
        })),
        selectedOffer
          ? { conglomerate: selectedOffer.conglomerate, amount: plannedAmount }
          : undefined,
      ),
    [plannedAmount, positions, selectedOffer],
  );

  return {
    offers,
    preferences,
    selectedOfferId,
    setSelectedOfferId,
    eligibleOffers,
    plannedAmount,
    summary,
  };
}
