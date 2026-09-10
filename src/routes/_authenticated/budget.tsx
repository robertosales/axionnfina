import { DataState } from "@/components/finance/DataState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { parseFinancialInput } from "@/lib/financial-input";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BudgetProgress } from "@/components/finance/BudgetProgress";
import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useBudgets, useEntityLifecycle, useUpsertBudget } from "@/lib/finance-data";
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
  const { confirm, confirmation } = useFinancialConfirmation();
  const [showArchived, setShowArchived] = useState(false);
  const {
    items: budgetItems,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useBudgets(showArchived);
  const plannedTotal = budgetItems.reduce((s, i) => s + i.planned, 0);
  const spent = budgetItems.reduce((s, i) => s + i.spent, 0);
  const upsert = useUpsertBudget();
  const lifecycle = useEntityLifecycle("budget");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [planned, setPlanned] = useState("");

  const save = async () => {
    const value = parseFinancialInput(planned);
    if (!category.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Informe categoria e valor planejado");
      return;
    }
    if (
      editingId &&
      !(await confirm(`Alterar orçamento de “${category}” para ${formatBRL(value)}?`))
    )
      return;
    upsert.mutate(
      { ...(editingId ? { id: editingId } : {}), category: category.trim(), planned: value },
      {
        onSuccess: () => {
          toast.success(editingId ? "Orçamento atualizado" : "Categoria salva");
          setOpen(false);
          setEditingId(null);
          setCategory("");
          setPlanned("");
        },
        onError: (error) =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return (
    <AppShell>
      {confirmation}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orçamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError
              ? "Dados indisponíveis"
              : isLoading
                ? "Carregando orçamento…"
                : `${formatBRL(spent)} gastos de ${formatBRL(plannedTotal)} planejados neste mês`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((value) => !value)}
          />
          {!showArchived && (
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setCategory("");
                setPlanned("");
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Nova categoria
            </Button>
          )}
        </div>
      </header>
      <DataState loading={isLoading} error={queryError || isError} onRetry={() => void refetch()}>
        {budgetItems.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Carregando orçamento…"
              : "Nenhuma categoria de orçamento cadastrada ainda."}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {budgetItems.map((item) => (
            <Card
              key={item.id}
              className="flex items-start gap-2 rounded-xl border-border/60 p-5 shadow-elevation-1"
            >
              <div className="min-w-0 flex-1">
                <BudgetProgress item={item} />
              </div>
              <EntityActionsMenu
                disabled={
                  lifecycle.archive.isPending ||
                  lifecycle.restore.isPending ||
                  lifecycle.remove.isPending
                }
                entityLabel="orçamento"
                recordName={item.category}
                archived={Boolean(item.archivedAt)}
                onEdit={() => {
                  setEditingId(item.id);
                  setCategory(item.category);
                  setPlanned(String(item.planned));
                  setOpen(true);
                }}
                onArchive={() =>
                  lifecycle.archive.mutate(item.id, {
                    onSuccess: () => toast.success("Orçamento arquivado"),
                    onError: (error) =>
                      toast.error(
                        "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                      ),
                  })
                }
                onRestore={() =>
                  lifecycle.restore.mutate(item.id, {
                    onSuccess: () => toast.success("Orçamento restaurado"),
                    onError: (error) =>
                      toast.error(
                        "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                      ),
                  })
                }
                onDelete={() =>
                  lifecycle.remove.mutate(item.id, {
                    onSuccess: () => toast.success("Orçamento excluído"),
                    onError: (error) =>
                      toast.error(
                        "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                      ),
                  })
                }
                deleteDisabledReason={
                  item.recordOrigin !== "manual"
                    ? "Registros sincronizados devem ser arquivados."
                    : undefined
                }
              />
            </Card>
          ))}
        </div>
      </DataState>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar orçamento" : "Nova categoria de orçamento"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat">Categoria</Label>
                <ValidatedInput
                  required
                  id="cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="planned">Valor planejado</Label>
                <MoneyInput
                  min={0.01}
                  id="planned"
                  value={planned}
                  onChange={(e) => setPlanned(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                data-financial-submit
                type="button"
                onClick={save}
                disabled={upsert.isPending}
              >
                {upsert.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
