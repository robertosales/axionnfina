import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/finance/ChartCard";
import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { InvestmentRadarPanel } from "@/components/finance/InvestmentRadarPanel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { netWorthSeries } from "@/lib/mock-data";
import {
  useEntityLifecycle,
  useInsights,
  useInvestmentAlertPreferences,
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
  const { data: agentInsights = [] } = useInsights(showArchived);
  const lifecycle = useEntityLifecycle("insight");
  const alertPreferences = useInvestmentAlertPreferences();
  const runMonitoring = useRunInvestmentMonitoring();

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
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

      <ChartCard title="Evolução do patrimônio" description="Últimos 6 meses">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthSeries} margin={{ left: -18, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="grad-nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
      </ChartCard>

      {!showArchived && (
        <div className="mt-6 space-y-4">
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
                    onError: (error) => toast.error(error.message),
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

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {agentInsights.map((insight) => (
          <Card
            key={insight.id}
            className={cn(
              "relative rounded-xl border p-5 pr-12 shadow-elevation-1",
              tone[insight.severity],
            )}
          >
            <div className="absolute right-3 top-3">
              <EntityActionsMenu
                entityLabel="insight"
                recordName={insight.title}
                archived={Boolean(insight.archivedAt)}
                onArchive={() =>
                  lifecycle.archive.mutate(insight.id, {
                    onSuccess: () => toast.success("Insight arquivado"),
                    onError: (error) => toast.error(error.message),
                  })
                }
                onRestore={() =>
                  lifecycle.restore.mutate(insight.id, {
                    onSuccess: () => toast.success("Insight restaurado"),
                    onError: (error) => toast.error(error.message),
                  })
                }
              />
            </div>
            <h2 className="text-sm font-semibold">{insight.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
          </Card>
        ))}
      </div>
      {agentInsights.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum insight {showArchived ? "arquivado" : "ativo"} no momento.
        </p>
      )}
    </AppShell>
  );
}
