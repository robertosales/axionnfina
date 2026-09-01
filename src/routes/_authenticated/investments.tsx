import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/finance/ChartCard";
import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { InvestmentRadarPanel } from "@/components/finance/InvestmentRadarPanel";
import { InvestmentPlanSimulator } from "@/components/finance/InvestmentPlanSimulator";
import { InvestmentPlanTracking } from "@/components/finance/InvestmentPlanTracking";
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
  useInvestments,
  useUpsertInvestmentPosition,
  type Position,
} from "@/lib/finance-data";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, type AssetClass } from "@/shared/domain";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const [showArchived, setShowArchived] = useState(false);
  const { positions, allocation, total, isLoading } = useInvestments(showArchived);
  const lifecycle = useEntityLifecycle("investment");
  const upsert = useUpsertInvestmentPosition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("stock");
  const [quantity, setQuantity] = useState("");
  const [averagePrice, setAveragePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");

  const openForm = (position?: Position) => {
    setEditingId(position?.id ?? null);
    setTicker(position?.ticker ?? "");
    setName(position?.name ?? "");
    setAssetClass(position?.assetClass ?? "stock");
    setQuantity(position ? String(position.quantity) : "");
    setAveragePrice(position ? String(position.averagePrice) : "");
    setCurrentPrice(position ? String(position.currentPrice) : "");
    setOpen(true);
  };

  const save = () => {
    const parsedQuantity = Number(quantity.replace(",", "."));
    const parsedAverage = Number(averagePrice.replace(",", "."));
    const parsedCurrent = Number(currentPrice.replace(",", "."));
    if (
      !ticker.trim() ||
      !name.trim() ||
      parsedQuantity <= 0 ||
      parsedAverage < 0 ||
      parsedCurrent < 0
    ) {
      toast.error("Preencha ativo, nome, quantidade e preços válidos");
      return;
    }
    upsert.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        ticker: ticker.trim(),
        name: name.trim(),
        assetClass,
        quantity: parsedQuantity,
        averagePrice: parsedAverage,
        currentPrice: parsedCurrent,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Posição atualizada" : "Posição incluída");
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investimentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Carteira consolidada de {formatBRL(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((value) => !value)}
          />
          {!showArchived && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="size-4" /> Nova posição
            </Button>
          )}
        </div>
      </header>

      {!showArchived && (
        <div className="mb-6 space-y-6">
          <InvestmentRadarPanel />
          <InvestmentPlanSimulator />
          <InvestmentPlanTracking />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando carteira…</p>}
      {!isLoading && positions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma posição cadastrada. Popule dados de exemplo no painel ou conecte uma corretora.
        </p>
      )}

      {positions.length > 0 && (
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
              {positions.map((position) => (
                <li key={position.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{position.ticker}</span>
                    <span className="text-xs text-muted-foreground">
                      {ASSET_CLASS_LABEL[position.assetClass]} · {position.name}
                    </span>
                  </span>
                  <span className="ml-auto text-right">
                    <span className="numeric block text-sm font-semibold">
                      {formatBRL(position.marketValue)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "numeric mt-1 rounded-full text-[10px]",
                        position.profit >= 0
                          ? "border-success/50 text-success"
                          : "border-danger/50 text-danger",
                      )}
                    >
                      {position.profit >= 0 ? "+" : ""}
                      {formatBRL(position.profit)}
                    </Badge>
                  </span>
                  <EntityActionsMenu
                    entityLabel="posição"
                    recordName={position.ticker}
                    archived={Boolean(position.archivedAt)}
                    onEdit={() => openForm(position)}
                    onArchive={() =>
                      lifecycle.archive.mutate(position.id, {
                        onSuccess: () => toast.success("Posição arquivada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onRestore={() =>
                      lifecycle.restore.mutate(position.id, {
                        onSuccess: () => toast.success("Posição restaurada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onDelete={() =>
                      lifecycle.remove.mutate(position.id, {
                        onSuccess: () => toast.success("Posição excluída"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    deleteDisabledReason={
                      position.recordOrigin !== "manual"
                        ? "Posições sincronizadas devem ser arquivadas."
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar posição" : "Nova posição"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ticker">Ativo</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                placeholder="PETR4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Nome</Label>
              <Input
                id="asset-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
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
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="average-price">Preço médio</Label>
              <Input
                id="average-price"
                inputMode="decimal"
                value={averagePrice}
                onChange={(event) => setAveragePrice(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="current-price">Preço atual</Label>
              <Input
                id="current-price"
                inputMode="decimal"
                value={currentPrice}
                onChange={(event) => setCurrentPrice(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando…" : "Salvar posição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
