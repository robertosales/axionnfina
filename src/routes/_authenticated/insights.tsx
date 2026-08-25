import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/finance/ChartCard";
import { Card } from "@/components/ui/card";
import { agentInsights, netWorthSeries } from "@/lib/mock-data";
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
  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Descobertas geradas pelo agente a partir dos seus dados sincronizados
        </p>
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

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {agentInsights.map((insight) => (
          <Card
            key={insight.id}
            className={cn("rounded-xl border p-5 shadow-elevation-1", tone[insight.severity])}
          >
            <h2 className="text-sm font-semibold">{insight.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
