import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { GoalTracker } from "@/components/finance/GoalTracker";
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
import { useGoals, useUpsertGoal } from "@/lib/finance-data";

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
  const { data: goals = [], isLoading } = useGoals();
  const upsert = useUpsertGoal();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [deadline, setDeadline] = useState("");

  const save = () => {
    const targetValue = Number(target.replace(",", "."));
    const currentValue = Number(current.replace(",", ".")) || 0;
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0) {
      toast.error("Informe título e valor alvo");
      return;
    }
    upsert.mutate(
      {
        title: title.trim(),
        targetAmount: targetValue,
        currentAmount: currentValue,
        deadline: deadline || null,
      },
      {
        onSuccess: () => {
          toast.success("Meta criada");
          setOpen(false);
          setTitle("");
          setTarget("");
          setCurrent("0");
          setDeadline("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {goals.length} metas ativas com projeção de aporte mensal
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nova meta
        </Button>
      </header>

      {goals.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando metas…" : "Você ainda não criou metas."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((goal) => (
          <GoalTracker key={goal.id} goal={goal} />
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="target">Valor alvo</Label>
                <Input id="target" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="current">Já guardado</Label>
                <Input id="current" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Prazo</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando…" : "Criar meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
