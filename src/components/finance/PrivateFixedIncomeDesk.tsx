import {
  AlertTriangle,
  ExternalLink,
  FileCheck2,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EntityActionsMenu } from "./EntityActionsMenu";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { buildInvestmentComparison } from "@/lib/investment-comparison";
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

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

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

  const parsedAmount = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const rankedPrivate =
    radar.data && offers.data
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
        maturityAlertDays: preferences.data.maturityAlertDays,
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
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Comparação ampliada
          </div>
          <h2 className="text-lg font-semibold">Tesouro, CDB, LCI e LCA no mesmo contexto</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compare aderência, prazo, liquidez, risco e proteção. Retorno estimado só aparece quando
            a origem privada está completa e dentro da validade.
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

        <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Filtrar origem">
          {(
            [
              ["all", "Todas"],
              ["treasury", "Fonte oficial"],
              ["private", "Ofertas privadas"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={scope === value ? "default" : "outline"}
              onClick={() => setScope(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {offers.isLoading || radar.isLoading ? (
          <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Organizando fontes, datas e condições…
          </div>
        ) : offers.isError || radar.isError ? (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            <AlertTriangle className="size-4 shrink-0" /> Não foi possível carregar a comparação.
          </div>
        ) : comparison.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma opção nesta origem. Cadastre uma oferta privada com o link da instituição ou
            escolha outro filtro.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {comparison.map((item) => {
              const privateOffer =
                item.origin === "private"
                  ? offers.data?.find((offer) => offer.id === item.id)
                  : null;
              return (
                <article
                  key={item.id}
                  className={cn(
                    "flex min-w-0 flex-col rounded-xl border p-4",
                    item.comparable ? "border-border/60" : "border-warning/30 bg-warning/[0.03]",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.productLabel}</Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            item.comparable
                              ? "border-success/40 text-success"
                              : "border-warning/40 text-warning",
                          )}
                        >
                          {item.comparable ? item.fitLabel : "Dados a revisar"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-base font-semibold">{item.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Emissor: {item.issuer}</p>
                    </div>
                    {privateOffer && (
                      <EntityActionsMenu
                        entityLabel="oferta"
                        recordName={item.name}
                        archived={Boolean(privateOffer.archivedAt)}
                        {...(!showArchived ? { onEdit: () => openForm(privateOffer) } : {})}
                        onArchive={() =>
                          lifecycle.archive.mutate(privateOffer.id, {
                            onSuccess: () => toast.success("Oferta arquivada"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                        onRestore={() =>
                          lifecycle.restore.mutate(privateOffer.id, {
                            onSuccess: () => toast.success("Oferta restaurada"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                        onDelete={() =>
                          lifecycle.remove.mutate(privateOffer.id, {
                            onSuccess: () => toast.success("Oferta excluída"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                        deleteDisabledReason={
                          privateOffer.recordOrigin !== "manual"
                            ? "Ofertas sincronizadas devem ser arquivadas."
                            : undefined
                        }
                      />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/35 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Remuneração</p>
                      <p className="numeric mt-1 font-semibold">{item.remuneration}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Aplicação mínima</p>
                      <p className="numeric mt-1 font-semibold">
                        {formatBRL(item.minimumInvestment)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vencimento</p>
                      <p className="numeric mt-1 font-semibold">
                        {new Date(`${item.maturityDate}T12:00:00`).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Aderência</p>
                      <p className="numeric mt-1 font-semibold">{item.fitScore}/100</p>
                    </div>
                  </div>

                  {item.estimate && (
                    <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                      {item.estimate}
                    </p>
                  )}

                  <Accordion type="single" collapsible className="mt-1">
                    <AccordionItem value="details">
                      <AccordionTrigger className="text-xs">
                        Risco, liquidez, impostos e custos
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 text-xs leading-5 text-muted-foreground">
                        <p>
                          <strong className="text-foreground">Risco:</strong> {item.risk}
                        </p>
                        <p>
                          <strong className="text-foreground">Liquidez:</strong> {item.liquidity}
                        </p>
                        <p>
                          <strong className="text-foreground">Tributação:</strong> {item.taxes}
                        </p>
                        <p>
                          <strong className="text-foreground">Custos:</strong> {item.costs}
                        </p>
                        <p>
                          <strong className="text-foreground">Proteção:</strong> {item.protection}
                        </p>
                        <div>
                          <strong className="text-foreground">Limitações:</strong>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {item.limitations.map((limitation) => (
                              <li key={limitation}>{limitation}</li>
                            ))}
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div
                    className={cn(
                      "mt-auto rounded-lg border p-3",
                      item.source.status === "verified"
                        ? "border-success/25 bg-success/[0.04]"
                        : "border-warning/30 bg-warning/[0.04]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <FileCheck2
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold">Passaporte da oferta</p>
                          <Badge variant="outline" className="text-[10px]">
                            {item.source.statusLabel}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.source.name} · referência{" "}
                          {new Date(`${item.source.referenceDate}T12:00:00`).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.source.scope}
                        </p>
                      </div>
                    </div>
                    {item.source.url && (
                      <Button variant="link" size="sm" className="mt-1 h-auto px-0 text-xs" asChild>
                        <a href={item.source.url} target="_blank" rel="noreferrer">
                          Abrir fonte <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" /> A ordem indica aderência aos critérios,
          não promessa de retorno. O suitability e a confirmação final continuam sendo feitos pela
          instituição onde a aplicação será contratada.
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
              label="Link HTTPS da oferta (obrigatório)"
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
