import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Compass, Info, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FINANCIAL_JOURNEY, type FinancialReadiness } from "@/lib/financial-next-step";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type FinancialNextStepCardProps = {
  analysis: FinancialReadiness;
  isLoading?: boolean;
  hasError?: boolean;
  /** Compact one-line variant for users who already have real data. */
  compact?: boolean;
};

export function FinancialNextStepCard({
  analysis,
  isLoading,
  hasError,
  compact,
}: FinancialNextStepCardProps) {
  if (isLoading) {
    if (compact) {
      return <Skeleton className="h-12 w-full rounded-xl" />;
    }
    return (
      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
        <div className="space-y-5 p-5 sm:p-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card
        className="rounded-2xl border-warning/40 bg-warning/5 p-5 shadow-elevation-1 sm:p-6"
        role="alert"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">
              Seu próximo passo
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Não foi possível calcular sua orientação agora
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Seus dados não foram alterados. Tente carregá-los novamente.
            </p>
          </div>
          <Button variant="outline" className="h-11" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  const currentIndex = FINANCIAL_JOURNEY.findIndex((item) => item.id === analysis.stage);
  const isEstimate = analysis.confidence.label === "Baixa";

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/20 shadow-elevation-1">
      <div className="border-b border-border/60 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Compass className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Seu próximo passo
              </p>
              <p className="text-xs text-muted-foreground">Orientação calculada pelos seus dados</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full bg-background/60",
              analysis.confidence.label === "Alta" && "border-success/40 text-success",
              analysis.confidence.label === "Média" && "border-warning/40 text-warning",
            )}
          >
            Confiança {analysis.confidence.label.toLowerCase()}
          </Badge>
        </div>

        <ol
          className="mt-5 grid grid-cols-5 gap-1"
          aria-label="Jornada financeira: Organizar, Economizar, Proteger, Investir e Acompanhar"
        >
          {FINANCIAL_JOURNEY.map((item, index) => {
            const completed = index < currentIndex;
            const current = index === currentIndex;
            return (
              <li key={item.id} aria-current={current ? "step" : undefined}>
                <div className="flex items-center" aria-hidden>
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                      completed && "border-success bg-success text-white",
                      current && "border-primary bg-primary text-primary-foreground",
                      !completed && !current && "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {completed ? <Check className="size-3" /> : index + 1}
                  </span>
                  {index < FINANCIAL_JOURNEY.length - 1 && (
                    <span
                      className={cn("h-px min-w-0 flex-1 bg-border", completed && "bg-success/60")}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 block truncate text-[10px] text-muted-foreground sm:text-xs",
                    current && "font-semibold text-foreground",
                    completed && "text-success",
                  )}
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Agora: {FINANCIAL_JOURNEY[currentIndex]?.label}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {analysis.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {analysis.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild className="h-11">
              <Link to={analysis.href}>
                {analysis.ctaLabel}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            {analysis.suggestedAmount !== null && analysis.suggestedAmountLabel && (
              <div>
                <p className="text-[11px] text-muted-foreground">{analysis.suggestedAmountLabel}</p>
                <p className="numeric text-sm font-semibold">
                  {formatBRL(analysis.suggestedAmount)}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside
          className="rounded-xl border border-border/60 bg-background/60 p-4"
          aria-label="Por que este passo"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <h3 className="text-sm font-semibold">Por que este passo?</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {analysis.reasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                {reason}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-2 border-t border-border/60 pt-3 text-[11px] leading-4 text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
            {isEstimate
              ? "Estimativa inicial: conecte mais dados para aumentar a confiança."
              : `Média baseada em ${analysis.metrics.monthsObserved} mês(es) de movimentações.`}
          </p>
        </aside>
      </div>
    </Card>
  );
}
