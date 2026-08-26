import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTaxSummary } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/taxes")({
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

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

function TaxesPage() {
  const { data, isLoading } = useTaxSummary();
  const now = new Date();

  const rows = [
    {
      label: "Ações — swing trade",
      base: data?.swing_gross ?? 0,
      tax: data?.swing_tax ?? 0,
      note: data?.swing_exempt ? "Isento (vendas até R$ 20.000/mês)" : "Alíquota 15%",
    },
    { label: "Day trade", base: 0, tax: data?.daytrade_tax ?? 0, note: "Alíquota 20%" },
    { label: "FIIs", base: 0, tax: data?.fii_tax ?? 0, note: "Alíquota 20%" },
    { label: "Dividendos", base: data?.dividends ?? 0, tax: 0, note: "Isentos na pessoa física" },
  ];

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Impostos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apuração de {MONTHS[now.getMonth()]} de {now.getFullYear()}
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Calculando apuração…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="rounded-xl border-border/60 p-5 shadow-elevation-1">
            <h2 className="text-base font-semibold">Apuração por natureza</h2>
            <ul className="mt-4 divide-y divide-border/60">
              {rows.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="numeric text-sm font-semibold">{formatBRL(item.base)}</p>
                    <p className="numeric text-xs text-muted-foreground">
                      imposto {formatBRL(item.tax)}
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
            <p className="numeric mt-3 text-2xl font-semibold">{formatBRL(data?.darf_due ?? 0)}</p>
            <Badge variant="outline" className="mt-2 rounded-full text-[10px]">
              Vencimento: último dia útil do mês seguinte
            </Badge>
            <p className="numeric mt-3 text-xs text-muted-foreground">
              IR retido na fonte: {formatBRL(data?.withheld ?? 0)}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Estimativa informativa gerada a partir das operações sincronizadas. A apuração
              definitiva depende da conferência de custos médios e prejuízos acumulados.
            </p>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
