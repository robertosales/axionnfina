import { CalendarClock, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useInvestmentAlertPreferences, type Position } from "@/lib/finance-data";
import { formatBRL, formatLongDate } from "@/lib/format";
import { buildMaturityLadder } from "@/lib/investment-maturity";
import { cn } from "@/lib/utils";

const bucketTone = {
  overdue: "bg-danger",
  days_30: "bg-warning",
  days_90: "bg-primary",
  days_180: "bg-primary/60",
  later: "bg-muted-foreground/35",
} as const;

export function InvestmentMaturityLadder({ positions }: { positions: Position[] }) {
  const preferences = useInvestmentAlertPreferences();
  const fixedIncome = positions.filter((position) => position.assetClass === "fixed_income");
  const missingMaturity = fixedIncome.filter((position) => !position.maturityDate);
  const referenceDate = new Date().toISOString().slice(0, 10);
  const ladder = buildMaturityLadder(
    fixedIncome,
    referenceDate,
    preferences.data?.maturityAlertDays ?? 30,
  );
  const events = ladder.items.slice(0, 5);
  const maximum = Math.max(...ladder.buckets.map((bucket) => bucket.total), 1);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <CalendarClock className="size-3.5" /> Agenda patrimonial
          </div>
          <h2 className="text-lg font-semibold">Régua de liquidez</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Antecipe entradas de caixa e revise cada posição antes do vencimento.
          </p>
        </div>
        {ladder.nextMaturity && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Próximo vencimento</p>
            <p className="numeric mt-1 text-lg font-semibold">
              {ladder.nextMaturity.daysUntilMaturity === 0
                ? "Hoje"
                : `${ladder.nextMaturity.daysUntilMaturity} dias`}
            </p>
          </div>
        )}
      </div>

      <div className="p-5">
        {preferences.isLoading ? (
          <p className="text-sm text-muted-foreground">Organizando vencimentos…</p>
        ) : preferences.isError ? (
          <p className="text-sm text-danger">Não foi possível carregar a régua de liquidez.</p>
        ) : ladder.items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma posição de renda fixa possui vencimento cadastrado.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <div>
              <div className="grid gap-3 sm:grid-cols-5">
                {ladder.buckets.map((bucket) => (
                  <div key={bucket.id} className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">{bucket.label}</p>
                    <p className="numeric mt-2 text-sm font-semibold">
                      {formatBRL(bucket.total, true)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {bucket.count} posição(ões)
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", bucketTone[bucket.id])}
                        style={{ width: `${(bucket.total / maximum) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted"
                aria-label="Distribuição temporal dos vencimentos"
              >
                {ladder.buckets.map((bucket) => (
                  <span
                    key={bucket.id}
                    className={bucketTone[bucket.id]}
                    style={{
                      width: `${ladder.totalWithMaturity > 0 ? (bucket.total / ladder.totalWithMaturity) * 100 : 0}%`,
                    }}
                    title={`${bucket.label}: ${formatBRL(bucket.total)}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Próximos eventos</h3>
              <ul className="mt-3 space-y-3">
                {events.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.ticker} · {item.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatLongDate(item.maturityDate!)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="numeric text-sm font-semibold">{formatBRL(item.marketValue)}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-1 rounded-full text-[10px]",
                          item.status === "upcoming" && "border-warning/40 text-warning",
                          item.status === "overdue" && "border-danger/40 text-danger",
                        )}
                      >
                        {item.daysUntilMaturity < 0
                          ? `${Math.abs(item.daysUntilMaturity)}d vencido`
                          : item.daysUntilMaturity === 0
                            ? "Hoje"
                            : `${item.daysUntilMaturity}d`}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {missingMaturity.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {missingMaturity.length} posição(ões) de renda fixa ainda não têm vencimento cadastrado.
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Alertas são gerados com {preferences.data?.maturityAlertDays ?? 30} dias de antecedência.
          O valor apresentado é o valor atual cadastrado, não uma promessa de resgate.
        </p>
      </div>
    </Card>
  );
}
