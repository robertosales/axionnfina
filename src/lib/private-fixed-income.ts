import type { InvestmentProfile } from "./investment-radar";

export const PRIVATE_PRODUCT_TYPES = ["cdb", "lci", "lca"] as const;
export type PrivateProductType = (typeof PRIVATE_PRODUCT_TYPES)[number];
export const PRIVATE_RATE_TYPES = ["fixed", "cdi", "ipca"] as const;
export type PrivateRateType = (typeof PRIVATE_RATE_TYPES)[number];

export type PrivateFixedIncomeOffer = {
  id: string;
  institution: string;
  conglomerate: string;
  productType: PrivateProductType;
  rateType: PrivateRateType;
  rateValue: number;
  referenceRate: number | null;
  minimumInvestment: number;
  maturityDate: string;
  dailyLiquidity: boolean;
  fgcEligible: boolean;
  sourceUrl: string | null;
  sourceCheckedAt: string;
  notes: string | null;
  archivedAt: string | null;
  recordOrigin: "manual" | "open_finance" | "import" | "system";
};

export type RankedPrivateOffer = PrivateFixedIncomeOffer & {
  grossAnnualRate: number;
  netAnnualRate: number;
  incomeTaxRate: number;
  daysToMaturity: number;
  projectedNetValue: number;
  score: number;
  eligible: boolean;
  fresh: boolean;
  sourceAgeDays: number;
  warnings: string[];
};

function daysBetween(start: string, end: string) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
}

export function fixedIncomeTaxRate(product: PrivateProductType, days: number) {
  if (product === "lci" || product === "lca") return 0;
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

export function grossAnnualRate(offer: PrivateFixedIncomeOffer) {
  if (offer.rateType === "fixed") return offer.rateValue / 100;
  if (offer.referenceRate == null) return 0;
  if (offer.rateType === "cdi") return (offer.referenceRate / 100) * (offer.rateValue / 100);
  return (1 + offer.referenceRate / 100) * (1 + offer.rateValue / 100) - 1;
}

export function rankPrivateOffers(
  offers: PrivateFixedIncomeOffer[],
  profile: InvestmentProfile,
  amount: number,
  referenceDate: string,
  maxSourceAgeDays = 7,
): RankedPrivateOffer[] {
  const prepared = offers.map((offer) => {
    const days = daysBetween(referenceDate, offer.maturityDate);
    const years = days / 365.25;
    const grossRate = grossAnnualRate(offer);
    const taxRate = fixedIncomeTaxRate(offer.productType, days);
    const grossReturn = Math.pow(1 + grossRate, years) - 1;
    const netReturn = grossReturn * (1 - taxRate);
    const netRate = Math.pow(1 + netReturn, 1 / years) - 1;
    const sourceAgeDays = Math.max(
      0,
      Math.floor(
        (new Date(`${referenceDate}T23:59:59Z`).getTime() -
          new Date(offer.sourceCheckedAt).getTime()) /
          86_400_000,
      ),
    );
    const fresh = sourceAgeDays <= maxSourceAgeDays;
    const eligible =
      amount >= offer.minimumInvestment &&
      offer.maturityDate >= referenceDate &&
      (offer.rateType === "fixed" || offer.referenceRate != null) &&
      fresh;
    return { offer, days, grossRate, taxRate, netRate, netReturn, eligible, fresh, sourceAgeDays };
  });
  const bestNetRate = Math.max(
    ...prepared.filter((item) => item.eligible).map((item) => item.netRate),
    0.0001,
  );

  return prepared
    .map(
      ({ offer, days, grossRate, taxRate, netRate, netReturn, eligible, fresh, sourceAgeDays }) => {
        const warnings: string[] = [];
        if (amount > 250_000 && offer.fgcEligible) {
          warnings.push(
            "O valor informado supera o limite ordinário de R$ 250 mil por conglomerado.",
          );
        }
        if (!offer.fgcEligible) warnings.push("Oferta marcada como não coberta pelo FGC.");
        if (offer.rateType !== "fixed" && offer.referenceRate == null) {
          warnings.push("Informe a taxa de referência usada na data da comparação.");
        }
        if (!fresh) {
          warnings.push(`Taxa conferida há ${sourceAgeDays} dias; confirme novamente na origem.`);
        }
        const horizonDays = profile.horizonMonths * 30.44;
        const horizonFit =
          days <= horizonDays ? 20 : Math.max(0, 20 - ((days - horizonDays) / 365) * 8);
        const liquidityFit =
          profile.liquidityPreference === "daily"
            ? offer.dailyLiquidity
              ? 20
              : 0
            : offer.dailyLiquidity
              ? 18
              : 12;
        const returnPoints = Math.max(0, Math.min(50, (netRate / bestNetRate) * 50));
        const protectionPoints = offer.fgcEligible && amount <= 250_000 ? 10 : 0;
        return {
          ...offer,
          grossAnnualRate: grossRate,
          netAnnualRate: netRate,
          incomeTaxRate: taxRate,
          daysToMaturity: days,
          projectedNetValue: amount * (1 + netReturn),
          score: eligible
            ? Math.round(returnPoints + horizonFit + liquidityFit + protectionPoints)
            : 0,
          eligible,
          fresh,
          sourceAgeDays,
          warnings,
        };
      },
    )
    .sort(
      (left, right) => Number(right.eligible) - Number(left.eligible) || right.score - left.score,
    );
}
