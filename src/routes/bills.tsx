import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { upcomingBills } from "@/lib/mock-data";
import { daysUntil, formatBRL, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bills")({
  head: () => ({
    meta: [
      { title: "Contas a pagar — Axionn Finance" },
      {
        name: "description",
        content:
          "Controle boletos e contas a pagar, com status de agendamento, atraso e leitura automática de boletos.",
      },
      { property: "og:title", content: "Contas a pagar — Axionn Finance" },
      {
        property: "og:description",
        content: "Boletos, vencimentos e agendamentos em uma única fila de pagamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillsPage,
});

function BillsPage() {
  const total = upcomingBills.reduce((s, b) => s + b.amount, 0);

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contas a pagar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {upcomingBills.length} contas · {formatBRL(total)} nos próximos 30 dias
          </p>
        </div>
        <Button size="sm">
          <Upload className="size-4" /> Enviar boleto
        </Button>
      </header>

      <Card className="rounded-xl border-border/60 p-0 shadow-elevation-1">
        <ul className="divide-y divide-border/60">
          {upcomingBills.map((bill) => {
            const days = daysUntil(bill.dueDate);
            return (
              <li key={bill.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLongDate(bill.dueDate)} ·{" "}
                    {days < 0 ? `${Math.abs(days)} dias em atraso` : `em ${days} dias`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[10px]",
                      bill.status === "OVERDUE" && "border-danger/50 text-danger",
                      bill.status === "SCHEDULED" && "border-success/50 text-success",
                    )}
                  >
                    {bill.status === "OVERDUE"
                      ? "Atrasada"
                      : bill.status === "SCHEDULED"
                        ? "Agendada"
                        : "Pendente"}
                  </Badge>
                  <span className="numeric w-28 text-right text-sm font-semibold">
                    {formatBRL(bill.amount)}
                  </span>
                  <Button variant="outline" size="sm">
                    Pagar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </AppShell>
  );
}
