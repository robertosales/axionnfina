import { BookOpen, CheckCircle2, ExternalLink, Lock, TriangleAlert } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatLongDate } from "@/lib/format";
import type { RankedOpportunity } from "@/lib/investment-radar";
import type { EquityOpportunity } from "@/lib/market-equities";
import { cn } from "@/lib/utils";

const KIND_LABELS = { etf: "ETF de índice", fii: "Fundo imobiliário" } as const;
const FIT_LABELS = {
  high: "Alta aderência",
  medium: "Aderência parcial",
  low: "Baixa aderência",
} as const;

export function EquityOpportunityCard({
  opportunity,
  rank,
  fixedIncomeReference,
}: {
  opportunity: EquityOpportunity;
  rank: number;
  fixedIncomeReference?: RankedOpportunity | undefined;
}) {
  const { quote } = opportunity;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-elevation-1 transition-colors sm:p-5",
        opportunity.studyOnly ? "border-border/60 opacity-95" : "border-border/70 hover:border-primary/30",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          opportunity.studyOnly
            ? "bg-muted-foreground/30"
            : opportunity.fit === "high"
              ? "bg-success"
              : opportunity.fit === "medium"
                ? "bg-warning"
                : "bg-muted-foreground/40",
        )}
      />

      <div className="flex flex-wrap items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="numeric text-xs font-semibold text-muted-foreground">#{rank}</span>
            <Badge variant="outline" className="rounded-full">
              {KIND_LABELS[opportunity.kind]}
            </Badge>
            {opportunity.studyOnly ? (
              <Badge variant="outline" className="rounded-full border-warning/40 bg-warning/10 text-warning">
                <Lock className="mr-1 size-3" /> Só para estudo
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full",
                  opportunity.fit === "high" && "border-success/40 bg-success/10 text-success",
                  opportunity.fit === "medium" && "border-warning/40 bg-warning/10 text-warning",
                )}
              >
                {FIT_LABELS[opportunity.fit]}
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight">{opportunity.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{opportunity.summary}</p>
        </div>
        <div className="rounded-xl bg-primary/8 px-3 py-2 text-right">
          <span className="numeric block text-xl font-semibold text-primary">
            {opportunity.studyOnly ? "—" : opportunity.score}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {opportunity.studyOnly ? "sem nota" : "de 100"}
          </span>
        </div>
      </div>

      {opportunity.studyOnly && opportunity.studyReason && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/8 p-3 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          {opportunity.studyReason}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-border/60 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Cotação</dt>
          <dd className="numeric mt-1 text-sm font-semibold">
            {quote?.price == null ? "Indisponível" : formatBRL(quote.price)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Hoje</dt>
          <dd className="numeric mt-1 text-sm font-medium">
            {quote?.changePercent == null
              ? "—"
              : `${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">12 meses</dt>
          <dd className="numeric mt-1 text-sm font-medium">
            {quote?.change12mPercent == null
              ? "—"
              : `${quote.change12mPercent > 0 ? "+" : ""}${quote.change12mPercent.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Oscilação</dt>
          <dd className="numeric mt-1 text-sm font-medium">{opportunity.riskLevel}/5</dd>
        </div>
      </dl>

      <Accordion type="single" collapsible>
        <AccordionItem value="explanation" className="border-0">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">
            <span className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" /> Entender antes de decidir
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>
              <strong className="font-medium">O que é:</strong>{" "}
              <span className="text-muted-foreground">{opportunity.whatItIs}</span>
            </p>
            <p>
              <strong className="font-medium">O que pode dar errado:</strong>{" "}
              <span className="text-muted-foreground">{opportunity.whatCanGoWrong}</span>
            </p>
            <p>
              <strong className="font-medium">Quanto custa:</strong>{" "}
              <span className="text-muted-foreground">{opportunity.costs}</span>
            </p>
            <p>
              <strong className="font-medium">Imposto:</strong>{" "}
              <span className="text-muted-foreground">{opportunity.taxes}</span>
            </p>
            <p>
              <strong className="font-medium">Costuma servir para:</strong>{" "}
              <span className="text-muted-foreground">{opportunity.suitableFor}</span>
            </p>

            {fixedIncomeReference && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                <strong className="block text-foreground">Comparação com a renda fixa</strong>
                Assumindo este risco você abre mão da previsibilidade de{" "}
                <strong className="text-foreground">{fixedIncomeReference.name}</strong>, hoje a{" "}
                <strong className="numeric text-foreground">{fixedIncomeReference.rateLabel}</strong>
                , com vencimento em {formatLongDate(fixedIncomeReference.maturityDate)} e garantia do
                Tesouro Nacional.
              </div>
            )}

            <ul className="space-y-2 border-t border-border/60 pt-3">
              {opportunity.evidence.map((evidence) => (
                <li key={evidence.label} className="flex items-start gap-2">
                  {evidence.impact === "warning" ? (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        evidence.impact === "positive" ? "text-success" : "text-muted-foreground",
                      )}
                    />
                  )}
                  <span>
                    <strong className="font-medium">{evidence.label}:</strong>{" "}
                    <span className="text-muted-foreground">{evidence.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl bg-warning/8 p-3 text-xs text-muted-foreground">
              {opportunity.warnings.join(" ")}
            </div>

            {quote && (
              <a
                href={quote.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Fonte: {quote.source} · {formatLongDate(quote.referenceDate)}
                <ExternalLink className="size-3" />
              </a>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}
