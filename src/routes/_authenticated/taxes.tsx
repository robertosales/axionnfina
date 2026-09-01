import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEntityLifecycle,
  useTaxEvents,
  useTaxSummary,
  useUpsertTaxEvent,
  type TaxEvent,
} from "@/lib/finance-data";
import { formatBRL, formatShortDate } from "@/lib/format";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, type AssetClass } from "@/shared/domain";

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
  const [showArchived, setShowArchived] = useState(false);
  const { data: events = [] } = useTaxEvents(showArchived);
  const lifecycle = useEntityLifecycle("tax_event");
  const upsert = useUpsertTaxEvent();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eventKind, setEventKind] = useState("swing");
  const [assetClass, setAssetClass] = useState<AssetClass>("stock");
  const [ticker, setTicker] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [profit, setProfit] = useState("");
  const [withheld, setWithheld] = useState("0");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const now = new Date();

  const openForm = (event?: TaxEvent) => {
    setEditingId(event?.id ?? null);
    setEventKind(event?.kind ?? "swing");
    setAssetClass(event?.assetClass ?? "stock");
    setTicker(event?.ticker ?? "");
    setGrossAmount(event ? String(event.grossAmount) : "");
    setProfit(event ? String(event.profit) : "");
    setWithheld(event ? String(event.withheld) : "0");
    setOccurredAt(event?.occurredAt ?? new Date().toISOString().slice(0, 10));
    setOpen(true);
  };

  const save = () => {
    const gross = Number(grossAmount.replace(",", "."));
    const result = Number(profit.replace(",", "."));
    const retained = Number(withheld.replace(",", "."));
    if (
      !ticker.trim() ||
      !Number.isFinite(gross) ||
      !Number.isFinite(result) ||
      !Number.isFinite(retained)
    ) {
      toast.error("Informe ativo e valores válidos");
      return;
    }
    upsert.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        kind: eventKind,
        assetClass,
        ticker: ticker.trim(),
        grossAmount: gross,
        profit: result,
        withheld: retained,
        occurredAt,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Evento atualizado" : "Evento incluído");
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Impostos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apuração de {MONTHS[now.getMonth()]} de {now.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((value) => !value)}
          />
          {!showArchived && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="size-4" /> Novo evento
            </Button>
          )}
        </div>
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

      <Card className="mt-6 rounded-xl border-border/60 p-5 shadow-elevation-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Eventos fiscais</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Operações que alimentam a memória de cálculo mensal.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {events.length}
          </Badge>
        </div>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum evento {showArchived ? "arquivado" : "ativo"}.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {event.ticker} · {ASSET_CLASS_LABEL[event.assetClass]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.kind} · {formatShortDate(event.occurredAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="numeric text-sm font-semibold">{formatBRL(event.grossAmount)}</p>
                  <p className="numeric text-xs text-muted-foreground">
                    resultado {formatBRL(event.profit)}
                  </p>
                </div>
                <EntityActionsMenu
                  entityLabel="evento fiscal"
                  recordName={`${event.ticker} em ${formatShortDate(event.occurredAt)}`}
                  archived={Boolean(event.archivedAt)}
                  onEdit={() => openForm(event)}
                  onArchive={() =>
                    lifecycle.archive.mutate(event.id, {
                      onSuccess: () => toast.success("Evento arquivado"),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                  onRestore={() =>
                    lifecycle.restore.mutate(event.id, {
                      onSuccess: () => toast.success("Evento restaurado"),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                  onDelete={() =>
                    lifecycle.remove.mutate(event.id, {
                      onSuccess: () => toast.success("Evento excluído"),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                  deleteDisabledReason={
                    event.recordOrigin !== "manual"
                      ? "Eventos sincronizados devem ser arquivados."
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar evento fiscal" : "Novo evento fiscal"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tax-ticker">Ativo</Label>
              <Input
                id="tax-ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Operação</Label>
              <Select value={eventKind} onValueChange={setEventKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="swing">Swing trade</SelectItem>
                  <SelectItem value="daytrade">Day trade</SelectItem>
                  <SelectItem value="dividend">Dividendo</SelectItem>
                  <SelectItem value="interest">Juros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Classe</Label>
              <Select
                value={assetClass}
                onValueChange={(value) => setAssetClass(value as AssetClass)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CLASSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ASSET_CLASS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax-gross">Valor bruto</Label>
              <Input
                id="tax-gross"
                inputMode="decimal"
                value={grossAmount}
                onChange={(event) => setGrossAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax-profit">Resultado</Label>
              <Input
                id="tax-profit"
                inputMode="decimal"
                value={profit}
                onChange={(event) => setProfit(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax-withheld">IR retido</Label>
              <Input
                id="tax-withheld"
                inputMode="decimal"
                value={withheld}
                onChange={(event) => setWithheld(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax-date">Data</Label>
              <Input
                id="tax-date"
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando…" : "Salvar evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
