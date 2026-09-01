import { ExternalLink, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EntityActionsMenu } from "./EntityActionsMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useEntityLifecycle,
  useInvestmentAlertPreferences,
  useInvestmentRadar,
  usePrivateFixedIncomeOffers,
  useUpsertPrivateFixedIncomeOffer,
  useUpdateInvestmentAlertPreferences,
} from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import {
  rankPrivateOffers,
  type PrivateFixedIncomeOffer,
  type PrivateProductType,
  type PrivateRateType,
} from "@/lib/private-fixed-income";
import { cn } from "@/lib/utils";

const PRODUCT_LABEL = { cdb: "CDB", lci: "LCI", lca: "LCA" } as const;
const RATE_LABEL = { fixed: "Prefixado", cdi: "% do CDI", ipca: "IPCA +" } as const;
const today = () => new Date().toISOString().slice(0, 10);

export function PrivateFixedIncomeDesk({ showArchived = false }: { showArchived?: boolean }) {
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

  const parsedAmount = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const ranked =
    radar.data && offers.data
      ? rankPrivateOffers(
          offers.data,
          radar.data.profile,
          parsedAmount,
          today(),
          Number(maxAgeDays) || 7,
        )
      : [];

  const saveComparisonSettings = () => {
    const days = Number(maxAgeDays);
    if (!preferences.data || parsedAmount <= 0 || days < 1 || days > 90) {
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
      },
      {
        onSuccess: () => toast.success("Critérios da comparação salvos"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const save = () => {
    const rate = Number(rateValue.replace(",", "."));
    const reference = Number(referenceRate.replace(",", "."));
    const minimum = Number(minimumInvestment.replace(",", "."));
    if (
      !institution.trim() ||
      !conglomerate.trim() ||
      !maturityDate ||
      rate <= 0 ||
      minimum < 0 ||
      (rateType !== "fixed" && !referenceRate.trim())
    ) {
      toast.error("Preencha instituição, conglomerado, taxas, mínimo e vencimento.");
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
        sourceUrl: sourceUrl || null,
        sourceCheckedAt: new Date().toISOString(),
        notes: null,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Oferta atualizada" : "Oferta incluída");
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Mesa comparadora
          </div>
          <h2 className="text-lg font-semibold">CDB, LCI e LCA</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compare ofertas conferidas por você pelo retorno líquido, prazo, liquidez e proteção.
          </p>
        </div>
        {!showArchived && (
          <Button size="sm" onClick={() => openForm()}>
            <Plus className="size-4" /> Incluir oferta
          </Button>
        )}
      </div>

      <div className="p-5">
        <div className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="comparison-amount">Valor para comparar</Label>
            <Input
              id="comparison-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-max-age">Validade da conferência</Label>
            <Input
              id="offer-max-age"
              type="number"
              min={1}
              max={90}
              value={maxAgeDays}
              onChange={(event) => setMaxAgeDays(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={saveComparisonSettings}
            disabled={updatePreferences.isPending || preferences.isLoading}
          >
            Salvar critérios
          </Button>
        </div>

        {offers.isLoading || radar.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Calculando retorno líquido…</p>
        ) : offers.isError || radar.isError ? (
          <p className="mt-5 text-sm text-danger">Não foi possível carregar a comparação.</p>
        ) : ranked.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Cadastre as ofertas exibidas pela sua instituição, com taxa, vencimento e origem.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {ranked.map((offer, index) => (
              <article
                key={offer.id}
                className="grid gap-4 rounded-xl border border-border/60 p-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(100px,.6fr))_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="numeric text-xs font-semibold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Badge variant="outline">{PRODUCT_LABEL[offer.productType]}</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        offer.eligible
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {offer.eligible ? "Comparável" : "Fora dos critérios"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        offer.fresh
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {offer.fresh ? `Conferida há ${offer.sourceAgeDays}d` : "Taxa vencida"}
                    </Badge>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-semibold">{offer.institution}</h3>
                  <p className="text-xs text-muted-foreground">
                    {offer.conglomerate} · {RATE_LABEL[offer.rateType]}{" "}
                    {offer.rateValue.toLocaleString("pt-BR")}
                    {offer.rateType === "cdi" ? "%" : "% a.a."}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Líquido anual</p>
                  <p className="numeric mt-1 font-semibold">
                    {(offer.netAnnualRate * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">No vencimento</p>
                  <p className="numeric mt-1 font-semibold">{formatBRL(offer.projectedNetValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Liquidez · proteção</p>
                  <p className="mt-1 text-sm">
                    {offer.dailyLiquidity ? "Diária" : "Vencimento"} ·{" "}
                    {offer.fgcEligible ? "FGC" : "Sem FGC"}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1">
                  {offer.sourceUrl && (
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={offer.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Abrir fonte da oferta"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  )}
                  <EntityActionsMenu
                    entityLabel="oferta"
                    recordName={`${PRODUCT_LABEL[offer.productType]} ${offer.institution}`}
                    archived={Boolean(offer.archivedAt)}
                    {...(!showArchived ? { onEdit: () => openForm(offer) } : {})}
                    onArchive={() =>
                      lifecycle.archive.mutate(offer.id, {
                        onSuccess: () => toast.success("Oferta arquivada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onRestore={() =>
                      lifecycle.restore.mutate(offer.id, {
                        onSuccess: () => toast.success("Oferta restaurada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onDelete={() =>
                      lifecycle.remove.mutate(offer.id, {
                        onSuccess: () => toast.success("Oferta excluída"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    deleteDisabledReason={
                      offer.recordOrigin !== "manual"
                        ? "Ofertas sincronizadas devem ser arquivadas."
                        : undefined
                    }
                  />
                </div>
                {offer.warnings.length > 0 && (
                  <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning lg:col-span-5">
                    {offer.warnings.join(" ")}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />O FGC cobre produtos elegíveis até os
          limites aplicáveis; confirme conglomerado, saldo total e condições na origem antes de
          investir.
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Alterar oferta" : "Incluir oferta"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Instituição"
              value={institution}
              onChange={setInstitution}
              id="offer-institution"
            />
            <Field
              label="Conglomerado"
              value={conglomerate}
              onChange={setConglomerate}
              id="offer-conglomerate"
            />
            <SelectField
              label="Produto"
              value={productType}
              onChange={(value) => setProductType(value as PrivateProductType)}
              options={Object.entries(PRODUCT_LABEL)}
            />
            <SelectField
              label="Tipo de taxa"
              value={rateType}
              onChange={(value) => setRateType(value as PrivateRateType)}
              options={Object.entries(RATE_LABEL)}
            />
            <Field
              label={
                rateType === "cdi"
                  ? "Percentual do CDI"
                  : rateType === "ipca"
                    ? "Adicional ao IPCA (% a.a.)"
                    : "Taxa (% a.a.)"
              }
              value={rateValue}
              onChange={setRateValue}
              id="offer-rate"
              numeric
            />
            {rateType !== "fixed" && (
              <Field
                label={
                  rateType === "cdi"
                    ? "CDI de referência (% a.a.)"
                    : "IPCA 12 meses de referência (%)"
                }
                value={referenceRate}
                onChange={setReferenceRate}
                id="offer-reference"
                numeric
              />
            )}
            <Field
              label="Aplicação mínima"
              value={minimumInvestment}
              onChange={setMinimumInvestment}
              id="offer-minimum"
              numeric
            />
            <Field
              label="Vencimento"
              value={maturityDate}
              onChange={setMaturityDate}
              id="offer-maturity"
              type="date"
            />
            <Field
              label="Link da origem"
              value={sourceUrl}
              onChange={setSourceUrl}
              id="offer-source"
              type="url"
            />
            <div className="space-y-3 rounded-xl border p-4">
              <Toggle
                label="Liquidez diária"
                checked={dailyLiquidity}
                onChange={setDailyLiquidity}
                id="offer-liquidity"
              />
              <Toggle
                label="Elegível ao FGC"
                checked={fgcEligible}
                onChange={setFgcEligible}
                id="offer-fgc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando…" : "Salvar oferta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  id,
  numeric,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  numeric?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={numeric ? "decimal" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  id,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
