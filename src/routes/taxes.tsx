import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/taxes")({
  head: () => ({
    meta: [
      { title: "Impostos — Axionn Finance" },
      {
        name: "description",
        content:
          "Prévia de IRPF mensal, apuração de swing trade, FIIs e dividendos, com DARF estimada.",
      },
      { property: "og:title", content: "Impostos — Axionn Finance" },
      {
        property: "og:description",
        content: "Apuração mensal de IRPF sobre investimentos e DARF estimada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaxesPage,
});

const apuracao = [
  { label: "Ações — swing trade", profit: 1240, rate: 0.15 },
  { label: "Ações — day trade", profit: 0, rate: 0.2 },
  { label: "FIIs", profit: 0, rate: 0.2 },
  { label: "Dividendos (isentos)", profit: 860, rate: 0 },
] as const;

function TaxesPage() {
  const darf = apuracao.reduce((sum, item) => sum + item.profit * item.rate, 0);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Impostos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Apuração de agosto de 2026</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
          <h2 className="text-base font-semibold">Apuração por natureza</h2>
          <ul className="mt-4 divide-y divide-border/60">
            {apuracao.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Alíquota {Math.round(item.rate * 100)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="numeric text-sm font-semibold">{formatBRL(item.profit)}</p>
                  <p className="numeric text-xs text-muted-foreground">
                    imposto {formatBRL(item.profit * item.rate)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="h-fit rounded-xl border-border/60 p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">DARF estimada</h2>
          </div>
          <p className="numeric mt-3 text-2xl font-semibold">{formatBRL(darf)}</p>
          <Badge variant="outline" className="mt-2 rounded-full text-[10px]">
            Vencimento: último dia útil de setembro
          </Badge>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Estimativa informativa gerada a partir das operações sincronizadas. A apuração
            definitiva depende da conferência de custos médios e prejuízos acumulados.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
