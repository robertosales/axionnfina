import { createFileRoute } from "@tanstack/react-router";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/finance/ChartCard";
import { Card } from "@/components/ui/card";
import { allocation } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/investments")({
  head: () => ({
    meta: [
      { title: "Investimentos — Axionn Finance" },
      {
        name: "description",
        content:
          "Carteira consolidada por classe de ativo, com alocação atual e sugestões de rebalanceamento.",
      },
      { property: "og:title", content: "Investimentos — Axionn Finance" },
      {
        property: "og:description",
        content: "Alocação da carteira por classe de ativo e posições consolidadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestmentsPage,
});

function InvestmentsPage() {
  const total = allocation.reduce((s, a) => s + a.value, 0);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Investimentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carteira consolidada de {formatBRL(total)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Alocação atual" description="Por classe de ativo">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  isAnimationActive={false}
                  stroke="none"
                >
                  {allocation.map((slice) => (
                    <Cell key={slice.name} fill={slice.token} />
                  ))}
                </Pie>
                <RTooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <h2 className="text-base font-semibold">Posições</h2>
          <ul className="mt-4 space-y-3">
            {allocation.map((slice) => (
              <li key={slice.name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: slice.token }}
                    aria-hidden
                  />
                  {slice.name}
                </span>
                <span className="text-right">
                  <span className="numeric block text-sm font-semibold">
                    {formatBRL(slice.value)}
                  </span>
                  <span className="numeric text-xs text-muted-foreground">
                    {Math.round((slice.value / total) * 100)}% da carteira
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
