import { parseFinancialInput } from "@/lib/financial-input";
import { localDateInput } from "@/lib/financial-input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useEntityLifecycle,
  useInvestmentAlertPreferences,
  useInvestmentRadar,
  usePrivateFixedIncomeOffers,
  useUpsertPrivateFixedIncomeOffer,
  useUpdateInvestmentAlertPreferences,
} from "@/lib/finance-data";
import { buildInvestmentComparison } from "@/lib/investment-comparison";
import {
  rankPrivateOffers,
  type PrivateFixedIncomeOffer,
  type PrivateProductType,
  type PrivateRateType,
} from "@/lib/private-fixed-income";

const today = () => localDateInput();

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function usePrivateFixedIncomeDesk(showArchived: boolean) {
  const offers = usePrivateFixedIncomeOffers(showArchived);
  const radar = useInvestmentRadar();
  const preferences = useInvestmentAlertPreferences();
  const updatePreferences = useUpdateInvestmentAlertPreferences();
  const upsert = useUpsertPrivateFixedIncomeOffer();
  const lifecycle = useEntityLifecycle("private_offer");

  const [amount, setAmount] = useState("10000");
  const [maxAgeDays, setMaxAgeDays] = useState("7");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PrivateFixedIncomeOffer | null>(null);
  const [institution, setInstitution] = useState("");
  const [conglomerate, setConglomerate] = useState("");
  const [productType, setProductType] = useState<PrivateProductType>("cdb");
  const [rateType, setRateType] = useState<PrivateRateType>("cdi");
  const [rateValue, setRateValue] = useState("");
  const [referenceRate, setReferenceRate] = useState("");
  const [minimumInvestment, setMinimumInvestment] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [dailyLiquidity, setDailyLiquidity] = useState(false);
  const [fgcEligible, setFgcEligible] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [scope, setScope] = useState<"all" | "treasury" | "private">("all");

  useEffect(() => {
    if (!preferences.data) return;
    setAmount(String(preferences.data.privateComparisonAmount));
    setMaxAgeDays(String(preferences.data.privateOfferMaxAgeDays));
  }, [preferences.data]);

  const openForm = (offer?: PrivateFixedIncomeOffer) => {
    setEditing(offer ?? null);
    setInstitution(offer?.institution ?? "");
    setConglomerate(offer?.conglomerate ?? "");
    setProductType(offer?.productType ?? "cdb");
    setRateType(offer?.rateType ?? "cdi");
    setRateValue(offer ? String(offer.rateValue) : "");
    setReferenceRate(offer?.referenceRate == null ? "" : String(offer.referenceRate));
    setMinimumInvestment(offer ? String(offer.minimumInvestment) : "");
    setMaturityDate(offer?.maturityDate ?? "");
    setDailyLiquidity(offer?.dailyLiquidity ?? false);
    setFgcEligible(offer?.fgcEligible ?? true);
    setSourceUrl(offer?.sourceUrl ?? "");
    setOpen(true);
  };

  const parsedAmount = parseFinancialInput(amount);
  const rankedPrivate =
    radar.data && offers.data && Number.isFinite(parsedAmount) && parsedAmount >= 0
      ? rankPrivateOffers(
          offers.data,
          radar.data.profile,
          parsedAmount,
          today(),
          Number(maxAgeDays) || 7,
        )
      : [];
  const comparison = radar.data
    ? buildInvestmentComparison(showArchived ? [] : radar.data.opportunities, rankedPrivate).filter(
        (item) => scope === "all" || item.origin === scope,
      )
    : [];

  const saveComparisonSettings = () => {
    const days = Number(maxAgeDays);
    if (
      !preferences.data ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      days < 1 ||
      days > 90
    ) {
      toast.error("Informe um valor positivo e uma validade entre 1 e 90 dias.");
      return;
    }
    updatePreferences.mutate(
      {
        enabled: preferences.data.enabled,
        inAppEnabled: preferences.data.inAppEnabled,
        minimumScore: preferences.data.minimumScore,
        scoreChangeThreshold: preferences.data.scoreChangeThreshold,
        driftThreshold: preferences.data.driftThreshold,
        privateComparisonAmount: parsedAmount,
        privateOfferMaxAgeDays: days,
        maturityAlertDays: preferences.data.maturityAlertDays,
      },
      {
        onSuccess: () => toast.success("Critérios da comparação salvos"),
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  const save = () => {
    const rate = parseFinancialInput(rateValue);
    const reference = parseFinancialInput(referenceRate);
    const minimum = parseFinancialInput(minimumInvestment);
    if (
      !institution.trim() ||
      !conglomerate.trim() ||
      !maturityDate ||
      !Number.isFinite(rate) ||
      !Number.isFinite(minimum) ||
      (rateType !== "fixed" && !Number.isFinite(reference)) ||
      rate <= 0 ||
      minimum < 0 ||
      !isHttpsUrl(sourceUrl) ||
      (rateType !== "fixed" && !referenceRate.trim())
    ) {
      toast.error("Preencha os dados e informe uma URL HTTPS verificável da oferta.");
      return;
    }
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        institution,
        conglomerate,
        productType,
        rateType,
        rateValue: rate,
        referenceRate: rateType === "fixed" ? null : reference,
        minimumInvestment: minimum,
        maturityDate,
        dailyLiquidity,
        fgcEligible,
        sourceUrl,
        sourceCheckedAt: new Date().toISOString(),
        notes: null,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Oferta atualizada" : "Oferta incluída");
          setOpen(false);
        },
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return {
    offers,
    radar,
    preferences,
    updatePreferences,
    upsert,
    lifecycle,
    amount,
    setAmount,
    maxAgeDays,
    setMaxAgeDays,
    open,
    setOpen,
    editing,
    institution,
    setInstitution,
    conglomerate,
    setConglomerate,
    productType,
    setProductType,
    rateType,
    setRateType,
    rateValue,
    setRateValue,
    referenceRate,
    setReferenceRate,
    minimumInvestment,
    setMinimumInvestment,
    maturityDate,
    setMaturityDate,
    dailyLiquidity,
    setDailyLiquidity,
    fgcEligible,
    setFgcEligible,
    sourceUrl,
    setSourceUrl,
    scope,
    setScope,
    comparison,
    openForm,
    saveComparisonSettings,
    save,
  };
}
