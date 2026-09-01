import {
  Archive,
  ArrowRight,
  Calculator,
  CircleDollarSign,
  FolderClock,
  Save,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEntityLifecycle,
  useInvestmentPlans,
  useInvestmentRadar,
  useUpsertInvestmentPlan,
} from "@/lib/finance-data";
import { formatBRL, formatLongDate } from "@/lib/format";
import { simulateInvestmentPlan, type SavedInvestmentPlan } from "@/lib/investment-plan";
import { cn } from "@/lib/utils";

const ALLOCATION_COLORS = ["bg-primary", "bg-success", "bg-warning"];

function numberFromInput(value: string): number {
  const compact = value.replace(/\s/g, "");
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InvestmentPlanSimulator() {
  const radar = useInvestmentRadar();
  const [showArchived, setShowArchived] = useState(false);
  const plans = useInvestmentPlans(showArchived);
  const upsert = useUpsertInvestmentPlan();
  const lifecycle = useEntityLifecycle("investment_plan");
  const [tab, setTab] = useState("simulate");
  const [initialAmount, setInitialAmount] = useState("1000");
  const [monthlyContribution, setMonthlyContribution] = useState("500");
  const [horizonMonths, setHorizonMonths] = useState(24);
  const [saveOpen, setSaveOpen] = useState(false);
  const [planName, setPlanName] = useState("Meu plano de aporte");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (radar.data?.profile.horizonMonths) setHorizonMonths(radar.data.profile.horizonMonths);
  }, [radar.data?.profile.horizonMonths]);

  const simulation = useMemo(
    () =>
      radar.data
        ? simulateInvestmentPlan(radar.data, {
            initialAmount: numberFromInput(initialAmount),
            monthlyContribution: numberFromInput(monthlyContribution),
            horizonMonths,
          })
        : null,
    [horizonMonths, initialAmount, monthlyContribution, radar.data],
  );

  const loadPlan = (plan: SavedInvestmentPlan) => {
    setInitialAmount(String(plan.input.initialAmount));
    setMonthlyContribution(String(plan.input.monthlyContribution));
    setHorizonMonths(plan.input.horizonMonths);
    setPlanName(plan.name);
    setEditingId(plan.id);
    setTab("simulate");
    toast.success("Plano carregado no simulador.");
  };

  const openNewSave = () => {
    setEditingId(null);
    setPlanName(
      `Plano de ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
    );
    setSaveOpen(true);
  };

  const savePlan = () => {
    if (!radar.data || !simulation || simulation.allocations.length === 0) {
      toast.error("O Radar precisa de oportunidades válidas antes de salvar.");
      return;
    }
    if (!planName.trim()) {
      toast.error("Informe um nome para o plano.");
      return;
    }
    if (simulation.input.initialAmount + simulation.input.monthlyContribution <= 0) {
      toast.error("Informe um aporte inicial ou mensal maior que zero.");
      return;
    }
    upsert.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        name: planName,
        simulation,
        marketReferenceDate: radar.data.referenceDate,
        profileSnapshot: radar.data.profile,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Plano atualizado." : "Plano salvo.");
          setSaveOpen(false);
          setTab("plans");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (radar.isLoading) {
    return <Skeleton className="h-[32rem] rounded-2xl" aria-label="Carregando simulador" />;
  }
  if (!radar.data || !simulation) return null;

  const referenceScenario = simulation.scenarios.find((scenario) => scenario.id === "reference");

  return (
    <section aria-labelledby="investment-plan-title">
      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-elevation-1">
        <div className="border-b border-border/60 bg-muted/25 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <Calculator className="size-4" /> Plano de aporte
              </div>
              <h2 id="investment-plan-title" className="mt-2 text-xl font-semibold tracking-tight">
                Transforme o ranking em uma estratégia mensal
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Simule a distribuição, compare cenários e salve versões para acompanhar depois.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
              <ShieldCheck className="mr-1 size-3.5" /> Sem execução automática
            </Badge>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="p-4 sm:p-6">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="simulate">Simular aporte</TabsTrigger>
            <TabsTrigger value="plans">Planos salvos</TabsTrigger>
          </TabsList>

          <TabsContent value="simulate" className="mt-5 space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-initial">Aporte inicial</Label>
                  <Input
                    id="plan-initial"
                    inputMode="decimal"
                    value={initialAmount}
                    onChange={(event) => setInitialAmount(event.target.value)}
                    aria-describedby="plan-values-help"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-monthly">Aporte mensal</Label>
                  <Input
                    id="plan-monthly"
                    inputMode="decimal"
                    value={monthlyContribution}
                    onChange={(event) => setMonthlyContribution(event.target.value)}
                    aria-describedby="plan-values-help"
                  />
                </div>
                <p id="plan-values-help" className="text-xs text-muted-foreground">
                  Digite valores em reais, sem incluir rendimentos esperados.
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="plan-horizon">Prazo do plano</Label>
                    <span className="numeric text-sm font-semibold">{horizonMonths} meses</span>
                  </div>
                  <Slider
                    id="plan-horizon"
                    min={1}
                    max={600}
                    step={1}
                    value={[Math.min(horizonMonths, 600)]}
                    onValueChange={(value) => setHorizonMonths(value[0] ?? 1)}
                    aria-label="Prazo do plano em meses"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1 mês</span>
                    <span>50 anos</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Total aportado</span>
                    <strong className="numeric mt-1 block text-sm">
                      {formatBRL(simulation.totalContributed)}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Taxa de referência</span>
                    <strong className="numeric mt-1 block text-sm">
                      {simulation.weightedAnnualRate.toFixed(2)}% a.a.
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Trilha do dinheiro</h3>
                  <span className="text-xs text-muted-foreground">Distribuição sugerida</span>
                </div>
                {simulation.allocations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhuma oportunidade possui dados suficientes para projeção.
                  </div>
                ) : (
                  simulation.allocations.map((allocation, index) => (
                    <div
                      key={allocation.opportunityId}
                      className="rounded-2xl border border-border/60 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 size-2.5 shrink-0 rounded-full",
                            ALLOCATION_COLORS[index],
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{allocation.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {allocation.reason}
                              </p>
                            </div>
                            <strong className="numeric text-lg">
                              {Math.round(allocation.weight * 100)}%
                            </strong>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", ALLOCATION_COLORS[index])}
                              style={{ width: `${allocation.weight * 100}%` }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              Agora:{" "}
                              <strong className="numeric text-foreground">
                                {formatBRL(allocation.initialAmount)}
                              </strong>
                            </span>
                            <span>
                              Por mês:{" "}
                              <strong className="numeric text-foreground">
                                {formatBRL(allocation.monthlyAmount)}
                              </strong>
                            </span>
                            <span>{allocation.rateLabel}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <h3 className="font-semibold">Cenários ao fim do prazo</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-3" aria-live="polite">
                {simulation.scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      scenario.id === "reference"
                        ? "border-primary/35 bg-primary/5"
                        : "border-border/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{scenario.label}</span>
                      <Badge variant="outline" className="numeric rounded-full text-[10px]">
                        {scenario.annualRate.toFixed(2)}% a.a.
                      </Badge>
                    </div>
                    <strong className="numeric mt-4 block text-xl">
                      {formatBRL(scenario.estimatedNetValue)}
                    </strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      ganho líquido estimado de {formatBRL(scenario.estimatedEarnings)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="assumptions">
                <AccordionTrigger className="text-sm">
                  Premissas e limitações da simulação
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {simulation.assumptions.map((assumption) => (
                      <li key={assumption}>• {assumption}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/35 p-4">
              <div className="flex items-center gap-3">
                <CircleDollarSign className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Cenário de referência</p>
                  <p className="text-xs text-muted-foreground">
                    {referenceScenario
                      ? formatBRL(referenceScenario.estimatedNetValue)
                      : "Sem projeção"}{" "}
                    — não é garantia de retorno.
                  </p>
                </div>
              </div>
              <Button
                onClick={editingId ? () => setSaveOpen(true) : openNewSave}
                disabled={simulation.allocations.length === 0}
              >
                <Save className="size-4" /> {editingId ? "Atualizar plano" : "Salvar plano"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Histórico de planos</h3>
                <p className="text-xs text-muted-foreground">
                  Carregue um plano para recalcular com o mercado atual.
                </p>
              </div>
              <LifecycleFilter
                showArchived={showArchived}
                onToggle={() => setShowArchived((value) => !value)}
              />
            </div>

            {plans.isLoading && <Skeleton className="h-32 rounded-2xl" />}
            {plans.isError && (
              <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
                <p className="text-sm font-medium">Não foi possível carregar os planos.</p>
                <p className="mt-1 text-xs text-muted-foreground">{plans.error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => plans.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            {!plans.isLoading && !plans.isError && (plans.data?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                {showArchived ? (
                  <Archive className="mx-auto size-8 text-muted-foreground" />
                ) : (
                  <FolderClock className="mx-auto size-8 text-muted-foreground" />
                )}
                <p className="mt-3 font-medium">
                  {showArchived ? "Nenhum plano arquivado" : "Nenhum plano salvo"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {showArchived
                    ? "Planos arquivados aparecerão aqui."
                    : "Crie uma simulação e salve sua primeira versão."}
                </p>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {(plans.data ?? []).map((plan) => {
                const reference = plan.scenarios.find((scenario) => scenario.id === "reference");
                return (
                  <article key={plan.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate font-medium">{plan.name}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Mercado de {formatLongDate(plan.marketReferenceDate)}
                        </p>
                      </div>
                      <EntityActionsMenu
                        entityLabel="plano"
                        recordName={plan.name}
                        archived={Boolean(plan.archivedAt)}
                        onEdit={() => loadPlan(plan)}
                        onArchive={() =>
                          lifecycle.archive.mutate(plan.id, {
                            onSuccess: () => toast.success("Plano arquivado"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                        onRestore={() =>
                          lifecycle.restore.mutate(plan.id, {
                            onSuccess: () => toast.success("Plano restaurado"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                        onDelete={() =>
                          lifecycle.remove.mutate(plan.id, {
                            onSuccess: () => toast.success("Plano excluído"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                      />
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Inicial</dt>
                        <dd className="numeric mt-1 text-sm font-medium">
                          {formatBRL(plan.input.initialAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Mensal</dt>
                        <dd className="numeric mt-1 text-sm font-medium">
                          {formatBRL(plan.input.monthlyContribution)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Projeção</dt>
                        <dd className="numeric mt-1 text-sm font-medium">
                          {reference ? formatBRL(reference.estimatedNetValue) : "—"}
                        </dd>
                      </div>
                    </dl>
                    {!plan.archivedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => loadPlan(plan)}
                      >
                        Recalcular com dados atuais <ArrowRight className="size-4" />
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Atualizar plano" : "Salvar plano"}</DialogTitle>
            <DialogDescription>
              Guarde as entradas, a distribuição e as premissas usadas nesta versão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="investment-plan-name">Nome do plano</Label>
            <Input
              id="investment-plan-name"
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={savePlan} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
