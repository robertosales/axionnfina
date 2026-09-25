import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { localDateInput, parseFinancialInput } from "@/lib/financial-input";
import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
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
import { Label } from "@/components/ui/label";
import {
  useArchiveProject,
  useProjects,
  useUpdateProjectProgress,
  useUpsertProject,
} from "@/lib/finance-data";
import { formatBRL, formatLongDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projetos — Axionn Finance" },
      {
        name: "description",
        content: "Acompanhe projetos pessoais (viagem, reforma, reserva) com progresso e prazo.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { confirm, confirmation } = useFinancialConfirmation();
  const [showArchived, setShowArchived] = useState(false);
  const { data: projects = [], isLoading, isError, error: queryError, refetch } = useProjects(showArchived);
  const upsert = useUpsertProject();
  const progress = useUpdateProjectProgress();
  const archive = useArchiveProject();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState("Viagem");
  const [startDate, setStartDate] = useState(localDateInput());
  const [endDate, setEndDate] = useState(localDateInput());
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");

  const save = async () => {
    const targetValue = parseFinancialInput(target);
    if (!name.trim() || !Number.isFinite(targetValue) || targetValue <= 0) {
      toast.error("Informe nome e valor alvo");
      return;
    }
    if (editingId && !(await confirm(`Alterar projeto "${name}"?`))) return;
    upsert.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        name: name.trim(),
        description: description.trim(),
        target: targetValue,
        category: category.trim() || "Outros",
        startDate,
        endDate,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Projeto atualizado" : "Projeto criado");
          setOpen(false);
          setEditingId(null);
          setName("");
          setDescription("");
          setTarget("");
        },
        onError: () => toast.error("Não foi possível salvar. Tente novamente."),
      },
    );
  };

  const add = async () => {
    if (!addId) return;
    const value = parseFinancialInput(addAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    progress.mutate(
      { id: addId, amount: value },
      {
        onSuccess: () => {
          toast.success("Aporte registrado");
          setAddOpen(false);
          setAddId(null);
          setAddAmount("");
        },
        onError: () => toast.error("Não foi possível registrar o aporte."),
      },
    );
  };

  return (
    <AppShell>
      {confirmation}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError ? "Dados indisponíveis" : isLoading ? "Carregando…" : `${projects.length} projetos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleFilter showArchived={showArchived} onToggle={() => setShowArchived((v) => !v)} />
          {!showArchived && (
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setName("");
                setDescription("");
                setTarget("");
                setCategory("Viagem");
                setStartDate(localDateInput());
                setEndDate(localDateInput());
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Novo projeto
            </Button>
          )}
        </div>
      </header>

      <DataState loading={isLoading} error={queryError || isError} onRetry={() => void refetch()}>
        {projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="Nenhum projeto criado"
            description="Crie projetos como viagem, reforma ou reserva e acompanhe o progresso."
          />
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const ratio = project.target > 0 ? Math.min(project.current / project.target, 1) : 0;
            return (
              <Card key={project.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.category} · até {formatLongDate(project.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={project.status === "completed" ? "secondary" : "outline"}>
                      {project.status === "completed" ? "Concluído" : "Ativo"}
                    </Badge>
                    <EntityActionsMenu
                      entityLabel="projeto"
                      recordName={project.name}
                      archived={Boolean(project.archivedAt)}
                      onEdit={() => {
                        setEditingId(project.id);
                        setName(project.name);
                        setDescription(project.description);
                        setTarget(String(project.target));
                        setCategory(project.category);
                        setStartDate(project.startDate);
                        setEndDate(project.endDate);
                        setOpen(true);
                      }}
                      onArchive={() =>
                        archive.mutate(project.id, {
                          onSuccess: () => toast.success("Projeto arquivado"),
                          onError: () => toast.error("Não foi possível arquivar."),
                        })
                      }
                      onRestore={() => toast.info("Use a lixeira para restaurar")}
                      onDelete={() => toast.info("Arquive em vez de excluir")}
                    />
                  </div>
                </div>
                {project.description && (
                  <p className="mt-2 text-xs text-muted-foreground">{project.description}</p>
                )}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span className="numeric">{formatBRL(project.current)}</span>
                  <span className="numeric">{formatBRL(project.target)}</span>
                </div>
                {project.status === "active" && !showArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setAddId(project.id);
                      setAddAmount("");
                      setAddOpen(true);
                    }}
                  >
                    Registrar aporte
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </DataState>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar projeto" : "Novo projeto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Nome</Label>
                <ValidatedInput required id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-description">Descrição</Label>
                <ValidatedInput id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="project-target">Valor alvo</Label>
                  <MoneyInput min={0.01} id="project-target" value={target} onChange={(e) => setTarget(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-category">Categoria</Label>
                  <ValidatedInput id="project-category" value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="project-start">Início</Label>
                  <ValidatedInput required id="project-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-end">Fim</Label>
                  <ValidatedInput required id="project-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button data-financial-submit type="button" onClick={save} disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Registrar aporte</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="add-amount">Valor</Label>
              <MoneyInput min={0.01} id="add-amount" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
            </div>
            <DialogFooter>
              <Button data-financial-submit type="button" onClick={add} disabled={progress.isPending}>
                {progress.isPending ? "Registrando…" : "Confirmar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
