import { ExternalLink, LineChart } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatBRL, formatLongDate } from "@/lib/format";
import type { MarketIndicator } from "@/lib/investment-radar";
import type { MarketOverview } from "@/lib/market-equities";
import { cn } from "@/lib/utils";

function changeTone(value: number | null): string {
  if (value == null) return "text-muted-foreground";
  if (value > 0) return "text-success";
  if (value < 0) return "text-danger";
  return "text-muted-foreground";
}

function formatChange(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function MarketOverviewStrip({
  overview,
  indicators,
}: {
  overview?: MarketOverview;
  indicators: MarketIndicator[];
}) {
  if (!overview && indicators.length === 0) return null;

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        <LineChart className="size-4" /> Como está o mercado hoje
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overview?.indices.map((index) => (
          <div key={index.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">{index.label}</span>
            <strong className="numeric mt-1 block text-base font-semibold">
              {index.value == null
                ? "Indisponível"
                : index.unit === "R$"
                  ? formatBRL(index.value)
                  : index.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </strong>
            <span className={cn("numeric text-xs font-medium", changeTone(index.changePercent))}>
              {formatChange(index.changePercent)} hoje
            </span>
          </div>
        ))}

        {indicators.map((indicator) => (
          <div key={indicator.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">{indicator.label}</span>
            <strong className="numeric mt-1 block text-base font-semibold">
              {indicator.value.toFixed(2)}%
            </strong>
            <span className="text-xs text-muted-foreground">
              {formatLongDate(indicator.referenceDate)}
            </span>
          </div>
        ))}
      </div>

      {overview && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{overview.summary}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {overview && (
          <a
            href={overview.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Bolsa e câmbio: {overview.source} · {formatLongDate(overview.referenceDate)}
            <ExternalLink className="size-3" />
          </a>
        )}
        {indicators.length > 0 && <span>Selic e IPCA: Banco Central do Brasil</span>}
        <span>Preços com atraso; não servem para operar em tempo real.</span>
      </div>
    </Card>
  );
}
