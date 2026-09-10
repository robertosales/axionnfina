import { formatPercent } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatLongDate } from "@/lib/format";
import { useInvestmentRadar, useUpdateInvestmentProfile } from "@/lib/finance-data";
import type {
  InvestmentObjective,
  InvestmentProfile,
  LiquidityPreference,
  RankedOpportunity,
  RiskProfile,
} from "@/lib/investment-radar";
import { cn } from "@/lib/utils";

const PROFILE_LABELS: Record<RiskProfile, string> = {
  conservative: "Conservador",
  moderate: "Moderado",
  aggressive: "Arrojado",
};

const LIQUIDITY_LABELS: Record<LiquidityPreference, string> = {
  daily: "Liquidez diária",
  up_to_1_year: "Posso esperar até 1 ano",
  long_term: "Foco no longo prazo",
};

const OBJECTIVE_LABELS: Record<InvestmentObjective, string> = {
  reserve: "Reserva de emergência",
  growth: "Crescimento patrimonial",
  retirement: "Aposentadoria",
  education: "Educação",
};

const FIT_LABELS = { high: "Alta aderência", medium: "Aderência parcial", low: "Baixa aderência" };

function OpportunityCard({ opportunity, rank }: { opportunity: RankedOpportunity; rank: number }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-elevation-1 transition-colors hover:border-primary/30 sm:p-5">
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          opportunity.fit === "high"
            ? "bg-success"
            : opportunity.fit === "medium"
              ? "bg-warning"
              : "bg-muted-foreground/40",
        )}
      />
      <div className="flex flex-wrap items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="numeric text-xs font-semibold text-muted-foreground">#{rank}</span>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full",
                opportunity.fit === "high" && "border-success/40 bg-success/10 text-success",
                opportunity.fit === "medium" && "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              {FIT_LABELS[opportunity.fit]}
            </Badge>
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight">{opportunity.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{opportunity.summary}</p>
        </div>
        <div className="rounded-xl bg-primary/8 px-3 py-2 text-right">
          <span className="numeric block text-xl font-semibold text-primary">
            {opportunity.score}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            de 100
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-border/60 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Taxa indicada
          </dt>
          <dd className="numeric mt-1 text-sm font-semibold">{opportunity.rateLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</dt>
          <dd className="numeric mt-1 text-sm font-medium">
            {formatLongDate(opportunity.maturityDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Entrada estimada
          </dt>
          <dd className="numeric mt-1 text-sm font-medium">
            {formatBRL(opportunity.minimumInvestment)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Risco de preço
          </dt>
          <dd className="numeric mt-1 text-sm font-medium">{opportunity.riskLevel}/5</dd>
        </div>
      </dl>

      <Accordion type="single" collapsible>
        <AccordionItem value="evidence" className="border-0">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">
            Ver evidências do ranking
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {opportunity.evidence.map((evidence) => (
                <li key={evidence.label} className="flex items-start gap-2 text-sm">
                  {evidence.impact === "warning" ? (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        evidence.impact === "positive" ? "text-success" : "text-muted-foreground",
                      )}
                    />
                  )}
                  <span>
                    <strong className="font-medium">{evidence.label}:</strong>{" "}
                    <span className="text-muted-foreground">{evidence.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {opportunity.warnings.length > 0 && (
              <div className="mt-3 rounded-xl bg-warning/8 p-3 text-xs text-muted-foreground">
                {opportunity.warnings.join(" ")}
              </div>
            )}
            <a
              href={opportunity.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Fonte: {opportunity.source} <ExternalLink className="size-3" />
            </a>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}

function RadarSkeleton() {
  return (
    <div className="space-y-3" aria-label="Carregando Radar de Investimentos">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

export function InvestmentRadarPanel({ compact = false }: { compact?: boolean }) {
  const radar = useInvestmentRadar();
  const updateProfile = useUpdateInvestmentProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [draft, setDraft] = useState<InvestmentProfile>({
    riskProfile: "conservative",
    horizonMonths: 24,
    liquidityPreference: "daily",
    objective: "reserve",
  });

  useEffect(() => {
    if (radar.data?.profile) setDraft(radar.data.profile);
  }, [radar.data?.profile]);

  const saveProfile = () => {
    if (draft.horizonMonths < 1 || draft.horizonMonths > 600) {
      toast.error("Informe um horizonte entre 1 e 600 meses.");
      return;
    }
    updateProfile.mutate(draft, {
      onSuccess: () => {
        toast.success("Preferências atualizadas. O ranking será recalculado.");
        setProfileOpen(false);
      },
      onError: (error) =>
        toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
    });
  };

  if (radar.isLoading) return <RadarSkeleton />;
  if (radar.isError) {
    return (
      <Card className="rounded-2xl border-danger/25 bg-danger/5 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 text-danger" />
          <div>
            <h2 className="font-semibold">Radar temporariamente indisponível</h2>
            <p className="mt-1 text-sm text-muted-foreground">{radar.error.message}</p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => radar.refetch()}>
              <RefreshCw className="size-4" /> Tentar novamente
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  if (!radar.data) return null;

  const data = radar.data;
  const opportunities = data.opportunities.slice(0, compact ? 3 : 8);

  return (
    <section aria-labelledby="investment-radar-title" className="space-y-4">
      <Card className="relative overflow-hidden rounded-2xl border-primary/20 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_42%)] p-5 shadow-elevation-1 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <ScanSearch className="size-4" /> Radar do dia
            </div>
            <h2
              id="investment-radar-title"
              className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Oportunidades compatíveis com sua realidade
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ranking educacional com dados oficiais, ajustado por risco, prazo, liquidez e reserva
              financeira.
            </p>
          </div>
          {!compact && (
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
              <SlidersHorizontal className="size-4" /> Ajustar perfil
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/75 p-3 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground">Perfil usado</span>
            <strong className="mt-1 block text-sm">
              {PROFILE_LABELS[data.profile.riskProfile]}
            </strong>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/75 p-3 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground">Horizonte</span>
            <strong className="numeric mt-1 block text-sm">
              {data.profile.horizonMonths} meses
            </strong>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/75 p-3 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground">Reserva estimada</span>
            <strong className="numeric mt-1 block text-sm">
              {data.context.reserveMonths == null
                ? "Sem histórico suficiente"
                : `${data.context.reserveMonths} meses`}
            </strong>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/75 p-3 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground">Dados de mercado</span>
            <strong className="numeric mt-1 block text-sm">
              {formatLongDate(data.referenceDate)}
            </strong>
          </div>
        </div>

        {data.indicators.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/60 pt-3">
            {data.indicators.map((indicator) => (
              <a
                key={indicator.id}
                href={indicator.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {indicator.label}:{" "}
                <strong className="numeric text-foreground">
                  {formatPercent(indicator.value).replace(/^\+/, "")}
                </strong>
              </a>
            ))}
          </div>
        )}
      </Card>

      {opportunities.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <ScanSearch className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum título disponível no último arquivo oficial.</p>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {opportunities.map((opportunity, index) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} rank={index + 1} />
          ))}
        </div>
      )}

      {(data.cacheStatus === "stale" ||
        data.sourceHealth.some((source) => source.status === "unavailable")) && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Parte das fontes está temporariamente indisponível. O Radar identificará claramente
            dados em cache e não preencherá indicadores ausentes.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-primary" /> {data.disclaimer}
        </span>
        {compact ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/investments">Abrir Radar completo</Link>
          </Button>
        ) : (
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.5" /> Atualizado em{" "}
            {new Date(data.generatedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferências do Radar</DialogTitle>
            <DialogDescription>
              Estas informações personalizam o ranking e não substituem o suitability da corretora.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="radar-risk">Tolerância a risco</Label>
              <Select
                value={draft.riskProfile}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, riskProfile: value as RiskProfile }))
                }
              >
                <SelectTrigger id="radar-risk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROFILE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="radar-horizon">Horizonte em meses</Label>
              <Input
                id="radar-horizon"
                type="number"
                min={1}
                max={600}
                value={draft.horizonMonths}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, horizonMonths: Number(event.target.value) }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="radar-liquidity">Necessidade de liquidez</Label>
              <Select
                value={draft.liquidityPreference}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    liquidityPreference: value as LiquidityPreference,
                  }))
                }
              >
                <SelectTrigger id="radar-liquidity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LIQUIDITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="radar-objective">Objetivo principal</Label>
              <Select
                value={draft.objective}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, objective: value as InvestmentObjective }))
                }
              >
                <SelectTrigger id="radar-objective">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJECTIVE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Recalculando…" : "Salvar e recalcular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
