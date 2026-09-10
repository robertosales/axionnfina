import { MoneyInput } from "@/components/finance/MoneyInput";
import { parseFinancialInput } from "@/lib/financial-input";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  RefreshCw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSavingPlanCheckIn,
  useSavingsPlans,
  useSyncSavingsOpportunities,
  useTransactions,
  useUpdateSavingsPlan,
} from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import {
  detectSavingsOpportunities,
  type SavingsPlan,
  type SavingsPlanStatus,
} from "@/lib/savings-opportunities";
import { cn } from "@/lib/utils";

const flow = [
  { id: "detected", label: "Detectado" },
  { id: "accepted", label: "Aceito" },
  { id: "tracking", label: "Em acompanhamento" },
  { id: "completed", label: "Concluído" },
] as const;

const kindLabel = {
  subscription: "Assinatura",
  recurring: "Recorrente",
  category_increase: "Categoria em alta",
  unusual_expense: "Fora do padrão",
} as const;

const previousMonth = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

function StatusFlow({ status }: { status: SavingsPlanStatus }) {
  const current = flow.findIndex((step) => step.id === status);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={`Situação: ${flow[current]?.label}`}>
      {flow.map((step, index) => (
        <li key={step.id}>
          <div className="flex items-center" aria-hidden>
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[9px]",
                index < current && "border-success bg-success text-white",
                index === current && "border-primary bg-primary text-primary-foreground",
                index > current && "border-border bg-background text-muted-foreground",
              )}
            >
              {index < current ? <Check className="size-3" /> : index + 1}
            </span>
            {index < flow.length - 1 && (
              <span className={cn("h-px flex-1 bg-border", index < current && "bg-success/60")} />
            )}
          </div>
          <span
            className={cn(
              "mt-1 block truncate text-[9px] text-muted-foreground sm:text-[10px]",
              index === current && "font-medium text-foreground",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SavingsPlanPanel() {
  const { data: transactions = [], isLoading: loadingTransactions } = useTransactions(1000);
  const { data: plans = [], isLoading: loadingPlans, isError, refetch } = useSavingsPlans();
  const sync = useSyncSavingsOpportunities();
  const update = useUpdateSavingsPlan();
  const checkIn = useSavingPlanCheckIn();
  const [checkInPlan, setCheckInPlan] = useState<SavingsPlan | null>(null);
  const [actualAmount, setActualAmount] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(previousMonth);
  const syncedSignature = useRef("");

  const opportunities = useMemo(() => detectSavingsOpportunities({ transactions }), [transactions]);
  const signature = opportunities
    .map((item) => item.key)
    .sort()
    .join("|");

  useEffect(() => {
    if (
      loadingTransactions ||
      loadingPlans ||
      isError ||
      !signature ||
      syncedSignature.current === signature
    ) {
      return;
    }
    syncedSignature.current = signature;
    sync.mutate(opportunities);
  }, [isError, loadingPlans, loadingTransactions, opportunities, signature, sync]);

  const detected = plans.filter((plan) => plan.status === "detected");
  const active = plans.filter((plan) => plan.status === "accepted" || plan.status === "tracking");
  const completed = plans.filter((plan) => plan.status === "completed");
  const plannedSaving = active.reduce((sum, plan) => sum + plan.expectedMonthlySaving, 0);
  const realizedSaving = plans.reduce(
    (sum, plan) =>
      sum + plan.checkIns.reduce((subtotal, item) => subtotal + item.realizedSaving, 0),
    0,
  );
  const loading = loadingTransactions || loadingPlans;

  const mutateStatus = (plan: SavingsPlan, status: SavingsPlanStatus) => {
    update.mutate(
      { id: plan.id, status },
      {
        onSuccess: () =>
          toast.success(
            status === "accepted"
              ? "Oportunidade adicionada ao seu plano"
              : status === "completed"
                ? "Plano concluído"
                : "Oportunidade dispensada",
          ),
        onError: (error) =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  const saveCheckIn = () => {
    if (!checkInPlan) return;
    const amount = parseFinancialInput(actualAmount);
    if (!Number.isFinite(amount) || amount < 0 || !referenceMonth) {
      toast.error("Informe o mês e quanto foi gasto");
      return;
    }
    checkIn.mutate(
      {
        planId: checkInPlan.id,
        referenceMonth,
        baselineAmount: checkInPlan.baselineMonthly,
        actualAmount: amount,
      },
      {
        onSuccess: () => {
          toast.success("Resultado mensal registrado");
          setCheckInPlan(null);
          setActualAmount("");
        },
        onError: (error) =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  if (loading) {
    return (
      <Card className="space-y-4 rounded-2xl border-border/60 p-5 shadow-elevation-1 sm:p-6">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card
        className="rounded-2xl border-warning/40 bg-warning/5 p-5 shadow-elevation-1"
        role="alert"
      >
        <h2 className="font-semibold">Não foi possível carregar o plano de economia</h2>
        <p className="mt-1 text-sm text-muted-foreground">Seus dados não foram alterados.</p>
        <Button variant="outline" className="mt-4 h-11" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <section aria-labelledby="savings-plan-title" className="space-y-4">
      <Card className="overflow-hidden rounded-2xl border-success/25 bg-gradient-to-br from-success/[0.08] via-card to-card shadow-elevation-1">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-success">
              <CircleDollarSign className="size-5" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Plano de economia</p>
            </div>
            <h2
              id="savings-plan-title"
              className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Transforme descobertas em dinheiro acompanhado
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              O Axionn identifica oportunidades. Você escolhe quais fazem sentido e confirma o
              resultado — nada é cancelado ou movimentado automaticamente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-80">
            <div className="rounded-xl border border-border/60 bg-background/70 p-3">
              <p className="text-[11px] text-muted-foreground">Meta mensal aceita</p>
              <p className="numeric mt-1 text-lg font-semibold">{formatBRL(plannedSaving)}</p>
            </div>
            <div className="rounded-xl border border-success/30 bg-success/5 p-3">
              <p className="text-[11px] text-muted-foreground">Economia confirmada</p>
              <p className="numeric mt-1 text-lg font-semibold text-success">
                {formatBRL(realizedSaving)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {detected.length === 0 && active.length === 0 && completed.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/70 p-6 text-center shadow-none">
          <Sparkles className="mx-auto size-6 text-primary" aria-hidden />
          <h3 className="mt-3 font-semibold">Ainda não há oportunidades confiáveis</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Precisamos de pelo menos dois a três meses de despesas. Continue conectando ou
            cadastrando suas movimentações.
          </p>
          <Button
            variant="outline"
            className="mt-4 h-11"
            onClick={() => sync.mutate(opportunities)}
            disabled={sync.isPending || opportunities.length === 0}
          >
            <RefreshCw className={cn(sync.isPending && "animate-spin")} aria-hidden />
            Atualizar análise
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Oportunidades encontradas</h3>
                <p className="text-xs text-muted-foreground">
                  Estimativas para você revisar antes de aceitar
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {detected.length} nova(s)
              </Badge>
            </div>

            {detected.length === 0 ? (
              <Card className="rounded-xl border-dashed p-5 text-sm text-muted-foreground shadow-none">
                Nenhuma oportunidade nova. Seus planos aceitos continuam ao lado.
              </Card>
            ) : (
              detected.map((plan) => (
                <Card key={plan.id} className="rounded-xl border-border/60 p-5 shadow-elevation-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {kindLabel[plan.kind]}
                      </Badge>
                      <h4 className="mt-2 font-semibold">{plan.title}</h4>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-muted-foreground">Potencial estimado</p>
                      <p className="numeric text-lg font-semibold">
                        {formatBRL(plan.expectedMonthlySaving)}/mês
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <StatusFlow status={plan.status} />
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {plan.evidence.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    <Button
                      className="h-11"
                      onClick={() => mutateStatus(plan, "accepted")}
                      disabled={update.isPending}
                    >
                      Adicionar ao plano <ArrowRight aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-11"
                      onClick={() => mutateStatus(plan, "dismissed")}
                      disabled={update.isPending}
                    >
                      <X aria-hidden /> Não faz sentido
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">Em acompanhamento</h3>
              <p className="text-xs text-muted-foreground">
                Resultados informados por você, mês a mês
              </p>
            </div>
            {active.length === 0 ? (
              <Card className="rounded-xl border-dashed p-5 text-sm text-muted-foreground shadow-none">
                Aceite uma oportunidade para começar seu plano.
              </Card>
            ) : (
              active.map((plan) => {
                const total = plan.checkIns.reduce((sum, item) => sum + item.realizedSaving, 0);
                return (
                  <Card
                    key={plan.id}
                    className="rounded-xl border-border/60 p-5 shadow-elevation-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold">{plan.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Meta: {formatBRL(plan.expectedMonthlySaving)}/mês
                        </p>
                      </div>
                      <Target className="size-5 text-primary" aria-hidden />
                    </div>
                    <div className="mt-4">
                      <StatusFlow status={plan.status} />
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 p-3">
                      <span className="text-xs text-muted-foreground">Economia confirmada</span>
                      <span className="numeric text-sm font-semibold text-success">
                        {formatBRL(total)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => {
                          setCheckInPlan(plan);
                          setReferenceMonth(previousMonth());
                          setActualAmount("");
                        }}
                      >
                        <ClipboardCheck aria-hidden /> Registrar resultado
                      </Button>
                      {plan.checkIns.length > 0 && (
                        <Button
                          variant="ghost"
                          className="h-11"
                          onClick={() => mutateStatus(plan, "completed")}
                        >
                          Concluir plano
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
            {completed.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {completed.length} plano(s) concluído(s).
              </p>
            )}
          </div>
        </div>
      )}

      <Dialog open={Boolean(checkInPlan)} onOpenChange={(open) => !open && setCheckInPlan(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Registrar resultado mensal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o gasto real. A economia confirmada será a diferença positiva em relação à média
            de {formatBRL(checkInPlan?.baselineMonthly ?? 0)}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="saving-month">Mês avaliado</Label>
              <Input
                id="saving-month"
                type="month"
                value={referenceMonth}
                onChange={(event) => setReferenceMonth(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saving-actual">Quanto você gastou?</Label>
              <MoneyInput
                min={0}
                id="saving-actual"
                inputMode="decimal"
                placeholder="0,00"
                value={actualAmount}
                onChange={(event) => setActualAmount(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="h-11" onClick={saveCheckIn} disabled={checkIn.isPending}>
              {checkIn.isPending ? "Salvando…" : "Confirmar resultado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
