import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { aggregateTags, useBulkRenameTag, useTransactions } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tags")({
  head: () => ({
    meta: [
      { title: "Tags — Axionn Finance" },
      {
        name: "description",
        content: "Gerencie as tags dos lançamentos: renomeie, mescle ou exclua.",
      },
    ],
  }),
  component: TagsPage,
});

function TagsPage() {
  const { confirm, confirmation } = useFinancialConfirmation();
  const { data: transactions = [], isLoading, isError, error: queryError, refetch } = useTransactions(null);
  const rename = useBulkRenameTag();
  const [search, setSearch] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");

  const stats = useMemo(() => aggregateTags(transactions), [transactions]);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const visible = stats.filter((s) => !query || s.tag.toLocaleLowerCase("pt-BR").includes(query));

  const openRename = (tag: string) => {
    setActiveTag(tag);
    setNewName(tag);
    setRenameOpen(true);
  };

  const openMerge = (tag: string) => {
    setActiveTag(tag);
    setMergeTarget("");
    setMergeOpen(true);
  };

  const doRename = async () => {
    if (!activeTag) return;
    const name = newName.trim();
    if (name.length < 2) {
      toast.error("Informe um nome com ao menos 2 caracteres");
      return;
    }
    if (name === activeTag) {
      setRenameOpen(false);
      return;
    }
    if (stats.some((s) => s.tag === name)) {
      toast.error("Essa tag já existe. Use Mesclar para juntar as duas.");
      return;
    }
    if (!(await confirm(`Renomear a tag "${activeTag}" para "${name}" em todos os lançamentos?`))) return;
    rename.mutate(
      { from: activeTag, to: name, transactions },
      {
        onSuccess: (count) => {
          toast.success(`Tag renomeada em ${count} lançamento(s)`);
          setRenameOpen(false);
          setActiveTag(null);
        },
        onError: () => toast.error("Não foi possível renomear. Tente novamente."),
      },
    );
  };

  const doMerge = async () => {
    if (!activeTag || !mergeTarget || mergeTarget === activeTag) return;
    if (
      !(await confirm(
        `Mesclar "${activeTag}" em "${mergeTarget}"? Os lançamentos passam a usar "${mergeTarget}".`,
      ))
    )
      return;
    rename.mutate(
      { from: activeTag, to: mergeTarget, transactions },
      {
        onSuccess: (count) => {
          toast.success(`${count} lançamento(s) mesclado(s) em "${mergeTarget}"`);
          setMergeOpen(false);
          setActiveTag(null);
        },
        onError: () => toast.error("Não foi possível mesclar. Tente novamente."),
      },
    );
  };

  const doDelete = async (tag: string) => {
    const count = stats.find((s) => s.tag === tag)?.count ?? 0;
    if (!(await confirm(`Excluir a tag "${tag}" de ${count} lançamento(s)? Os lançamentos são mantidos.`)))
      return;
    rename.mutate(
      { from: tag, to: null, transactions },
      {
        onSuccess: (updated) => toast.success(`Tag excluída de ${updated} lançamento(s)`),
        onError: () => toast.error("Não foi possível excluir. Tente novamente."),
      },
    );
  };

  return (
    <AppShell>
      {confirmation}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError
              ? "Dados indisponíveis"
              : isLoading
                ? "Carregando tags…"
                : `${stats.length} tags em uso`}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar tag"
            aria-label="Pesquisar tag"
          />
        </div>
      </header>

      <DataState loading={isLoading} error={queryError || isError} onRetry={() => void refetch()}>
        {stats.length === 0 && (
          <EmptyState
            icon={TagIcon}
            title="Nenhuma tag em uso"
            description="Adicione tags ao registrar ou editar lançamentos para organizá-los. Separe por vírgula, ex.: casa, mensal."
          />
        )}
        {visible.length === 0 && stats.length > 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tag encontrada para essa busca.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((stat) => (
            <Card key={stat.tag} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="max-w-full truncate">
                  {stat.tag}
                </Badge>
                <span className="numeric shrink-0 text-xs text-muted-foreground">
                  {stat.count} lançamento(s)
                </span>
              </div>
              <p className="numeric mt-2 text-lg font-semibold">{formatBRL(stat.total)}</p>
              <p className="text-[11px] text-muted-foreground">Soma dos lançamentos marcados</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openRename(stat.tag)}>
                  <Pencil className="size-3.5" /> Renomear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={stats.length < 2}
                  onClick={() => openMerge(stat.tag)}
                >
                  <Plus className="size-3.5" /> Mesclar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  disabled={rename.isPending}
                  onClick={() => void doDelete(stat.tag)}
                >
                  <Trash2 className="size-3.5" /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DataState>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Renomear tag “{activeTag}”</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="tag-new-name">Novo nome</Label>
              <ValidatedInput
                required
                id="tag-new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button data-financial-submit type="button" onClick={doRename} disabled={rename.isPending}>
                {rename.isPending ? "Salvando…" : "Renomear"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Mesclar “{activeTag}” em outra tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="tag-merge-target">Tag de destino</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger id="tag-merge-target">
                  <SelectValue placeholder="Selecione a tag" />
                </SelectTrigger>
                <SelectContent>
                  {stats
                    .filter((s) => s.tag !== activeTag)
                    .map((s) => (
                      <SelectItem key={s.tag} value={s.tag}>
                        {s.tag} ({s.count})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                data-financial-submit
                type="button"
                onClick={doMerge}
                disabled={rename.isPending || !mergeTarget}
              >
                {rename.isPending ? "Mesclando…" : "Mesclar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
