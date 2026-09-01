import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInvestmentAlertPreferences,
  usePrivateFixedIncomeOffers,
  type Position,
} from "@/lib/finance-data";
import { calculateFgcExposure, FGC_ORDINARY_LIMIT } from "@/lib/fgc-exposure";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusCopy = {
  safe: { label: "Com margem", tone: "border-success/40 text-success" },
  attention: { label: "Próximo do limite", tone: "border-warning/40 text-warning" },
  exceeded: { label: "Acima do limite", tone: "border-danger/40 text-danger" },
} as const;

export function FgcExposurePanel({ positions }: { positions: Position[] }) {
  const offers = usePrivateFixedIncomeOffers(false);
  const preferences = useInvestmentAlertPreferences();
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const eligibleOffers = (offers.data ?? []).filter((offer) => offer.fgcEligible);

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

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Concentração bancária
          </div>
          <h2 className="text-lg font-semibold">Faixa de cobertura FGC</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consolidação educacional por conglomerado, incluindo juros registrados no valor atual.
          </p>
        </div>
        <div className="min-w-64 space-y-1.5">
          <Label htmlFor="fgc-planned-offer">
            Simular novo aporte de {formatBRL(plannedAmount)}
          </Label>
          <Select value={selectedOfferId || "none"} onValueChange={setSelectedOfferId}>
            <SelectTrigger id="fgc-planned-offer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem novo aporte</SelectItem>
              {eligibleOffers.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>
                  {offer.productType.toUpperCase()} · {offer.institution}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-5">
        {offers.isLoading || preferences.isLoading ? (
          <p className="text-sm text-muted-foreground">Consolidando conglomerados…</p>
        ) : offers.isError || preferences.isError ? (
          <p className="text-sm text-danger">Não foi possível calcular a cobertura.</p>
        ) : summary.groups.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Edite posições de renda fixa e informe quais produtos são elegíveis ao FGC.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {summary.groups.map((group) => (
              <article key={group.conglomerate} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{group.conglomerate}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Atual {formatBRL(group.currentExposure)}
                      {group.plannedAmount > 0 && ` + aporte ${formatBRL(group.plannedAmount)}`}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("rounded-full", statusCopy[group.status].tone)}
                  >
                    {statusCopy[group.status].label}
                  </Badge>
                </div>
                <div
                  className="relative mt-5 h-3 overflow-hidden rounded-full bg-muted"
                  aria-label={`${Math.round(group.utilization * 100)}% do limite ordinário`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      group.status === "safe"
                        ? "bg-success"
                        : group.status === "attention"
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                    style={{ width: `${Math.min(100, group.utilization * 100)}%` }}
                  />
                  <span className="absolute inset-y-0 right-0 w-0.5 bg-foreground/60" />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
                  <span>
                    Projetado: <strong>{formatBRL(group.projectedExposure)}</strong>
                  </span>
                  <span className={cn(group.uncoveredAmount > 0 && "text-danger")}>
                    {group.uncoveredAmount > 0
                      ? `Acima: ${formatBRL(group.uncoveredAmount)}`
                      : `Margem: ${formatBRL(group.remainingMargin)}`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        {summary.unclassifiedAmount > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            {formatBRL(summary.unclassifiedAmount)} em posições elegíveis ainda não têm conglomerado
            informado.
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Referência ordinária: {formatBRL(FGC_ORDINARY_LIMIT)} por CPF/CNPJ e conglomerado.
          Confirme produtos, associação e saldo diretamente no FGC e na instituição.
        </p>
      </div>
    </Card>
  );
}
