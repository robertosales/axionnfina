import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { GoalTracker } from "@/components/finance/GoalTracker";
import { goals } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Metas — Axionn Finance" },
      {
        name: "description",
        content:
          "Acompanhe metas financeiras com progresso, prazo e contribuição mensal sugerida pelo agente.",
      },
      { property: "og:title", content: "Metas — Axionn Finance" },
      {
        property: "og:description",
        content: "Progresso das metas, prazos e aportes mensais necessários.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {goals.length} metas ativas com projeção de aporte mensal
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((goal) => (
          <GoalTracker key={goal.id} goal={goal} />
        ))}
      </div>
    </AppShell>
  );
}
