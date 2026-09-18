import { localDateInput } from "@/lib/financial-input";
import {
  useInvestmentAlertPreferences,
  useInvestmentPlans,
  useInvestmentRadar,
  useInvestments,
  usePrivateFixedIncomeOffers,
} from "@/lib/finance-data";
import { calculateFgcExposure } from "@/lib/fgc-exposure";
import { buildInvestmentBriefing } from "@/lib/investment-briefing";
import { buildMaturityLadder } from "@/lib/investment-maturity";
import { calculateInvestmentPlanProgress } from "@/lib/investment-progress";
import { rankPrivateOffers } from "@/lib/private-fixed-income";
import { useMemo } from "react";

export function useInvestmentBriefing() {
  const investments = useInvestments(false);
  const plans = useInvestmentPlans(false);
  const offers = usePrivateFixedIncomeOffers(false);
  const radar = useInvestmentRadar();
  const preferences = useInvestmentAlertPreferences();

  const loading =
    investments.isLoading ||
    plans.isLoading ||
    offers.isLoading ||
    radar.isLoading ||
    preferences.isLoading;

  const failed =
    investments.isError || plans.isError || offers.isError || radar.isError || preferences.isError;

  const today = localDateInput();

  const briefing = useMemo(() => {
    if (loading || failed) return { actions: [], missingMetadataCount: 0 };

    const progress =
      investments.positions.length > 0
        ? (plans.data ?? []).map((plan) =>
            calculateInvestmentPlanProgress(
              plan,
              investments.positions.map((position) => ({
                id: position.id,
                ticker: position.ticker,
                name: position.name,
                marketValue: position.marketValue,
              })),
            ),
          )
        : [];

    const fgc = calculateFgcExposure(
      investments.positions.map((position) => ({
        id: position.id,
        name: position.name,
        marketValue: position.marketValue,
        conglomerate: position.conglomerate,
        fgcEligible: position.fgcEligible,
      })),
    );

    const maturities = buildMaturityLadder(
      investments.positions,
      today,
      preferences.data?.maturityAlertDays ?? 30,
    );

    const privateRanking = radar.data
      ? rankPrivateOffers(
          offers.data ?? [],
          radar.data.profile,
          preferences.data?.privateComparisonAmount ?? 10_000,
          today,
          preferences.data?.privateOfferMaxAgeDays ?? 7,
        )
      : [];

    const missingMetadataCount = investments.positions.filter(
      (position) =>
        position.assetClass === "fixed_income" &&
        (!position.maturityDate || (position.fgcEligible === true && !position.conglomerate)),
    ).length;

    const topPrivateOffer = privateRanking.find((offer) => offer.eligible);
    const topPublicOpportunity = radar.data?.opportunities[0];

    const actions = buildInvestmentBriefing({
      fgc,
      maturities,
      planProgress: progress,
      ...(topPrivateOffer ? { topPrivateOffer } : {}),
      ...(topPublicOpportunity ? { topPublicOpportunity } : {}),
      missingMetadataCount,
    });

    return { actions, missingMetadataCount };
  }, [
    loading,
    failed,
    investments.positions,
    plans.data,
    offers.data,
    radar.data,
    preferences.data,
    today,
  ]);

  return {
    loading,
    failed,
    actions: briefing.actions,
    missingMetadataCount: briefing.missingMetadataCount,
  };
}
