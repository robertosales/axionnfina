import type { ReactNode } from "react";

import { MoneyInput } from "@/components/finance/MoneyInput";
import { EmptyState } from "@/components/finance/EmptyState";
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
import { formatBRL } from "@/lib/format";
import type { SavingsPlan, SavingsPlanStatus } from "@/lib/savings-opportunities";
import { cn } from "@/lib/utils";
import { useSavingsPlanPanel } from "./use-savings-plan-panel";

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

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function PlanSummary({
  plannedSaving,
  realizedSaving,
}: {
  plannedSaving: number;
  realizedSaving: number;
}) {
  return (
    <Card className="overflow-hidden border-success/25 bg-gradient-to-br from-success/[0.08] via-card to-card">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-success">
            <CircleDollarSign className="size-4" aria-hidden />
            Plano de economia
          </p>
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
        <dl className="grid gap-3 sm:grid-cols-2 lg:min-w-80">
          <div className="rounded-lg border border-border bg-background/70 p-3 sm:p-4">
            <dt className="text-xs text-muted-foreground">Meta mensal aceita</dt>
            <dd className="numeric mt-1 text-lg font-semibold">{formatBRL(plannedSaving)}</dd>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-3 sm:p-4">
            <dt className="text-xs text-muted-foreground">Economia confirmada</dt>
            <dd className="numeric mt-1 text-lg font-semibold text-success">
              {formatBRL(realizedSaving)}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function DetectedOpportunityCard({
  plan,
  pending,
  onAccept,
  onDismiss,
}: {
  plan: SavingsPlan;
  pending: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="flex h-full flex-col rounded-xl border-border/60 p-4 shadow-elevation-1 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <Badge variant="outline" className="rounded-full text-[10px]">
            {kindLabel[plan.kind]}
          </Badge>
          <h4 className="mt-2 text-sm font-semibold sm:text-base">{plan.title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.description}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left sm:text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Potencial estimado
          </p>
          <p className="mt-0.5 text-lg font-semibold">
            <span className="numeric">{formatBRL(plan.expectedMonthlySaving)}</span>
            <span className="text-xs font-medium text-muted-foreground">/mês</span>
          </p>
        </div>
      </div>
      <div className="mt-4">
        <StatusFlow status={plan.status} />
      </div>
      <ul className="mt-3 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {plan.evidence.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button className="h-11" onClick={onAccept} disabled={pending}>
          Adicionar ao plano <ArrowRight aria-hidden />
        </Button>
        <Button variant="ghost" className="h-11" onClick={onDismiss} disabled={pending}>
          <X aria-hidden /> Não faz sentido
        </Button>
      </div>
    </Card>
  );
}

function TrackingOpportunityCard({
  plan,
  confirmedSaving,
  onRegister,
  onComplete,
}: {
  plan: SavingsPlan;
  confirmedSaving: number;
  onRegister: () => void;
  onComplete: () => void;
}) {
  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{plan.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Meta:{" "}
            <span className="numeric font-medium text-foreground">
              {formatBRL(plan.expectedMonthlySaving)}
            </span>
            /mês
          </p>
        </div>
        <Target className="size-5 shrink-0 text-primary" aria-hidden />
      </div>
      <div className="mt-4">
        <StatusFlow status={plan.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3">
        <span className="text-xs text-muted-foreground">Economia confirmada</span>
        <span className="numeric text-sm font-semibold text-success">
          {formatBRL(confirmedSaving)}
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        <Button variant="outline" className="h-11" onClick={onRegister}>
          <ClipboardCheck aria-hidden /> Registrar resultado
        </Button>
        {plan.checkIns.length > 0 && (
          <Button variant="ghost" className="h-11" onClick={onComplete}>
            Concluir plano
          </Button>
        )}
      </div>
    </Card>
  );
}

const previousMonthFn = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function SavingsPlanPanel() {
  const {
    loading,
    isError,
    refetch,
    sync,
    opportunities,
    detected,
    active,
    completed,
    plannedSaving,
    realizedSaving,
    checkInPlan,
    setCheckInPlan,
    actualAmount,
    setActualAmount,
    referenceMonth,
    setReferenceMonth,
    mutateStatus,
    saveCheckIn,
  } = useSavingsPlanPanel();

  if (loading) {
    return (
      <Card role="status" aria-label="Carregando plano de economia" className="space-y-4 p-5 sm:p-6">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-warning/40 bg-warning/5 p-5" role="alert">
        <h2 className="font-semibold">Não foi possível carregar o plano de economia</h2>
        <p className="mt-1 text-sm text-muted-foreground">Seus dados não foram alterados.</p>
        <Button variant="outline" className="mt-4 h-11" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  const hasAnyPlan = detected.length > 0 || active.length > 0 || completed.length > 0;

  return (
    <section aria-labelledby="savings-plan-title" className="space-y-4">
      <PlanSummary plannedSaving={plannedSaving} realizedSaving={realizedSaving} />

      {!hasAnyPlan ? (
        <Card className="border-dashed p-6 text-center shadow-none">
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(17rem,1fr)] xl:gap-6">
          <div className="space-y-4 @container">
            <SectionHeading
              title="Oportunidades encontradas"
              description="Estimativas para você revisar antes de aceitar"
              action={
                <Badge
                  variant="outline"
                  className="numeric rounded-full border-primary/30 bg-primary/10 px-2.5 text-primary"
                >
                  {detected.length} nova(s)
                </Badge>
              }
            />

            {detected.length === 0 ? (
              <Card className="rounded-xl border-dashed shadow-none">
                <EmptyState
                  title="Nenhuma oportunidade nova"
                  description="Seus planos aceitos continuam em acompanhamento."
                />
              </Card>
            ) : (
              <div className="grid gap-4 @xl:grid-cols-2">
                {detected.map((plan) => (
                  <DetectedOpportunityCard
                    key={plan.id}
                    plan={plan}
                    pending={sync.isPending}
                    onAccept={() => mutateStatus(plan, "accepted")}
                    onDismiss={() => mutateStatus(plan, "dismissed")}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <SectionHeading
              title="Em acompanhamento"
              description="Resultados informados por você, mês a mês"
            />
            {active.length === 0 ? (
              <Card className="rounded-xl border-dashed shadow-none">
                <EmptyState
                  icon={Target}
                  title="Nenhuma oportunidade em acompanhamento"
                  description="Quando você aceitar uma oportunidade, o progresso aparecerá aqui."
                />
              </Card>
            ) : (
              active.map((plan) => (
                <TrackingOpportunityCard
                  key={plan.id}
                  plan={plan}
                  confirmedSaving={plan.checkIns.reduce(
                    (sum, item) => sum + item.realizedSaving,
                    0,
                  )}
                  onRegister={() => {
                    setCheckInPlan(plan);
                    setReferenceMonth(previousMonthFn());
                    setActualAmount("");
                  }}
                  onComplete={() => mutateStatus(plan, "completed")}
                />
              ))
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar resultado mensal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o gasto real. A economia confirmada será a diferença positiva em relação à média
            de <span className="numeric">{formatBRL(checkInPlan?.baselineMonthly ?? 0)}</span>.
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
            <Button className="h-11" onClick={saveCheckIn} disabled={sync.isPending}>
              {sync.isPending ? "Salvando…" : "Confirmar resultado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
