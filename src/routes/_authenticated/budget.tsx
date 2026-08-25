import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { BudgetProgress } from "@/components/finance/BudgetProgress";
import { Card } from "@/components/ui/card";
import { budgetItems } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Orçamento — Axionn Finance" },
      {
        name: "description",
        content:
          "Acompanhe o orçamento por categoria com alertas de 80% e 100%, rollover e comparação com o realizado.",
      },
      { property: "og:title", content: "Orçamento — Axionn Finance" },
      {
        property: "og:description",
        content: "Planejado x realizado por categoria, com alertas de estouro e rollover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const planned = budgetItems.reduce((s, i) => s + i.planned, 0);
  const spent = budgetItems.reduce((s, i) => s + i.spent, 0);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Orçamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatBRL(spent)} gastos de {formatBRL(planned)} planejados neste mês
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {budgetItems.map((item) => (
          <Card key={item.id} className="rounded-xl border-border/60 p-5 shadow-elevation-1">
            <BudgetProgress item={item} />
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
