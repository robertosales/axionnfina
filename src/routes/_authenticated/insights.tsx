import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { ChartCard } from "@/components/finance/ChartCard";
import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { InvestmentDecisionBriefing } from "@/components/finance/InvestmentDecisionBriefing";
import { InvestmentRadarPanel } from "@/components/finance/InvestmentRadarPanel";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { SavingsPlanPanel } from "@/components/finance/SavingsPlanPanel";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useEntityLifecycle,
  useInsights,
  useInvestmentAlertPreferences,
  useNetWorthSeries,
  useRunInvestmentMonitoring,
} from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Axionn Finance" },
      {
        name: "description",
        content:
          "Descobertas automáticas do agente sobre gastos, poupança e impostos, com evolução do patrimônio.",
      },
      { property: "og:title", content: "Insights — Axionn Finance" },
      {
        property: "og:description",
        content: "Alertas e descobertas geradas automaticamente sobre suas finanças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

const tone = {
  info: "border-primary/40 bg-primary/5",
  success: "border-success/40 bg-success/5",
  warning: "border-warning/40 bg-warning/5",
  danger: "border-danger/40 bg-danger/5",
} as const;

function InsightsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: agentInsights = [], isLoading, isError, refetch } = useInsights(showArchived);
  const lifecycle = useEntityLifecycle("insight");
  const alertPreferences = useInvestmentAlertPreferences();
  const runMonitoring = useRunInvestmentMonitoring();
  const netWorth = useNetWorthSeries();

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Descobertas geradas pelo agente a partir dos seus dados sincronizados
            </p>
          </div>
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((value) => !value)}
          />
        </header>

        {!showArchived && <SavingsPlanPanel />}

        <section aria-labelledby="agent-insights-title" className="space-y-4">
          <div className="min-w-0">
            <h2 id="agent-insights-title" className="text-base font-semibold tracking-tight">
              Descobertas do agente
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Alertas e descobertas gerados automaticamente a partir das suas movimentações
            </p>
          </div>
          <DataState
            loading={isLoading}
            error={isError}
            empty={agentInsights.length === 0}
            suppressEmpty
            onRetry={() => void refetch()}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agentInsights.map((insight) => (
                <Card
                  key={insight.id}
                  className={cn(
                    "relative flex h-full flex-col rounded-xl border p-5 pr-12 shadow-elevation-1",
                    tone[insight.severity],
                  )}
                >
                  <div className="absolute right-3 top-3">
                    <EntityActionsMenu
                      disabled={
                        lifecycle.archive.isPending ||
                        lifecycle.restore.isPending ||
                        lifecycle.remove.isPending
                      }
                      entityLabel="insight"
                      recordName={insight.title}
                      archived={Boolean(insight.archivedAt)}
                      onArchive={() =>
                        lifecycle.archive.mutate(insight.id, {
                          onSuccess: () => toast.success("Insight arquivado"),
                          onError: (error) =>
                            toast.error(
                              "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                            ),
                        })
                      }
                      onRestore={() =>
                        lifecycle.restore.mutate(insight.id, {
                          onSuccess: () => toast.success("Insight restaurado"),
                          onError: (error) =>
                            toast.error(
                              "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                            ),
                        })
                      }
                    />
                  </div>
                  <h3 className="text-sm font-semibold">{insight.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {insight.body}
                  </p>
                </Card>
              ))}
            </div>
          </DataState>
          {!isLoading && !isError && agentInsights.length === 0 && (
            <EmptyState
              icon={Sparkles}
              title={`Nenhum insight ${showArchived ? "arquivado" : "ativo"} no momento.`}
              description="Novas descobertas aparecem aqui assim que seus dados são sincronizados."
              className="rounded-xl border border-dashed py-8"
            />
          )}
        </section>

        <ChartCard title="Evolução do patrimônio" description="Histórico mensal real">
          {netWorth.isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Carregando histórico…
            </div>
          ) : netWorth.isError ? (
            <div className="flex h-64 items-center justify-center text-sm text-danger">
              Não foi possível carregar a evolução do patrimônio.
            </div>
          ) : (netWorth.data?.length ?? 0) === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 text-center">
              <p className="text-sm font-medium">Ainda não há snapshots mensais</p>
              <p className="max-w-md text-xs text-muted-foreground">
                O gráfico aparecerá depois que seus saldos reais forem registrados ao longo do tempo.
              </p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorth.data ?? []} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="grad-nw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickFormatter={(v: number) => formatBRL(v, true)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={70}
                  />
                  <RTooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    isAnimationActive={false}
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#grad-nw)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {!showArchived && (
          <div className="space-y-4">
            <InvestmentDecisionBriefing />
            <InvestmentRadarPanel compact />
            <Card className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-border/60 p-4 shadow-elevation-1">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <BellRing className="size-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">Monitoramento de investimentos</h2>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {alertPreferences.data?.enabled === false ? "Pausado" : "Ativo"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {alertPreferences.data?.lastEvaluatedAt
                      ? `Última avaliação em ${new Date(alertPreferences.data.lastEvaluatedAt).toLocaleString("pt-BR")}`
                      : "Aguardando a primeira avaliação diária."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/investments">Ver plano × carteira</Link>
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    runMonitoring.mutate(undefined, {
                      onSuccess: () => toast.success("Monitoramento atualizado"),
                      onError: (error) =>
                        toast.error(
                          "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                        ),
                    })
                  }
                  disabled={runMonitoring.isPending}
                >
                  <RefreshCw className={cn("size-4", runMonitoring.isPending && "animate-spin")} />
                  {runMonitoring.isPending ? "Analisando…" : "Atualizar agora"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
