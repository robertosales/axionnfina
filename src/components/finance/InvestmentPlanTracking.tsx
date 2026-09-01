import { Activity, BellRing, RefreshCw, Settings2, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_INVESTMENT_ALERT_PREFERENCES,
  useInvestmentAlertPreferences,
  useInvestmentPlans,
  useInvestmentProgressHistory,
  useInvestments,
  useRunInvestmentMonitoring,
  useUpdateInvestmentAlertPreferences,
  type InvestmentAlertPreferences,
} from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { calculateInvestmentPlanProgress } from "@/lib/investment-progress";
import { cn } from "@/lib/utils";

const statusCopy = {
  aligned: { label: "No alvo", className: "border-success/40 bg-success/10 text-success" },
  attention: { label: "Atenção", className: "border-warning/40 bg-warning/10 text-warning" },
  off_track: { label: "Fora do alvo", className: "border-danger/40 bg-danger/10 text-danger" },
} as const;

function percentage(value: number) {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function clampPercentage(value: number) {
  return `${Math.min(100, Math.max(0, value * 100))}%`;
}

export function InvestmentPlanTracking() {
  const plans = useInvestmentPlans(false);
  const investments = useInvestments(false);
  const preferences = useInvestmentAlertPreferences();
  const updatePreferences = useUpdateInvestmentAlertPreferences();
  const runMonitoring = useRunInvestmentMonitoring();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<InvestmentAlertPreferences>(
    DEFAULT_INVESTMENT_ALERT_PREFERENCES,
  );

  useEffect(() => {
    if (!selectedPlanId && plans.data?.[0]) setSelectedPlanId(plans.data[0].id);
  }, [plans.data, selectedPlanId]);

  useEffect(() => {
    if (preferences.data) setDraft(preferences.data);
  }, [preferences.data]);

  const selectedPlan = plans.data?.find((plan) => plan.id === selectedPlanId);
  const progress = useMemo(() => {
    if (!selectedPlan) return null;
    return calculateInvestmentPlanProgress(
      selectedPlan,
      investments.positions.map((position) => ({
        id: position.id,
        ticker: position.ticker,
        name: position.name,
        marketValue: position.marketValue,
      })),
    );
  }, [investments.positions, selectedPlan]);
  const history = useInvestmentProgressHistory(selectedPlanId || undefined);

  const savePreferences = () => {
    if (
      draft.minimumScore < 0 ||
      draft.minimumScore > 100 ||
      draft.scoreChangeThreshold < 1 ||
      draft.scoreChangeThreshold > 50 ||
      draft.driftThreshold < 1 ||
      draft.driftThreshold > 100 ||
      draft.maturityAlertDays < 1 ||
      draft.maturityAlertDays > 365
    ) {
      toast.error("Revise os limites: nota 0–100, variação 1–50 e desvio 1–100.");
      return;
    }
    updatePreferences.mutate(
      {
        enabled: draft.enabled,
        inAppEnabled: draft.inAppEnabled,
        minimumScore: draft.minimumScore,
        scoreChangeThreshold: draft.scoreChangeThreshold,
        driftThreshold: draft.driftThreshold,
        privateComparisonAmount: draft.privateComparisonAmount,
        privateOfferMaxAgeDays: draft.privateOfferMaxAgeDays,
        maturityAlertDays: draft.maturityAlertDays,
      },
      {
        onSuccess: () => {
          toast.success("Alertas de investimento atualizados");
          setSettingsOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const updateNow = () => {
    runMonitoring.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          `Análise atualizada: ${result?.plansEvaluated ?? 0} plano(s) e ${result?.insightsCreated ?? 0} novo(s) insight(s).`,
        ),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Activity className="size-3.5" /> Acompanhamento preventivo
          </div>
          <h2 className="text-lg font-semibold">Plano × carteira real</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Veja onde a carteira se afastou do plano e distribua o próximo aporte sem vender ativos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" /> Alertas
          </Button>
          <Button size="sm" onClick={updateNow} disabled={runMonitoring.isPending}>
            <RefreshCw className={cn("size-4", runMonitoring.isPending && "animate-spin")} />
            {runMonitoring.isPending ? "Analisando…" : "Atualizar análise"}
          </Button>
        </div>
      </div>

      {plans.isLoading || investments.isLoading ? (
        <p className="p-5 text-sm text-muted-foreground">Calculando aderência do plano…</p>
      ) : plans.isError || investments.isError ? (
        <div className="p-5">
          <p className="text-sm font-medium text-danger">Não foi possível comparar o plano.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recarregue a página ou tente novamente em alguns instantes.
          </p>
        </div>
      ) : !plans.data?.length ? (
        <div className="p-5">
          <p className="text-sm font-medium">Salve uma simulação para começar.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O acompanhamento compara as metas do plano com as posições cadastradas na carteira.
          </p>
        </div>
      ) : (
        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="tracking-plan">Plano acompanhado</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger id="tracking-plan" className="w-full">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.data.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {progress && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Desvio total</p>
                  <p className="numeric mt-1 text-2xl font-semibold">
                    {progress.overallDrift.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">p.p.</span>
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("h-7 rounded-full px-3", statusCopy[progress.status].className)}
                >
                  {statusCopy[progress.status].label}
                </Badge>
              </>
            )}
          </div>

          {progress && investments.positions.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed p-5">
              <p className="text-sm font-medium">Cadastre as posições atuais da sua carteira.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Assim o sistema identifica os desvios e sugere a divisão do próximo aporte.
              </p>
            </div>
          ) : progress ? (
            <>
              <div className="mt-6 grid gap-3 xl:grid-cols-2">
                {progress.lines.map((line) => (
                  <div key={line.opportunityId} className="rounded-xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {line.matchedPositionIds.length
                            ? `${line.matchedPositionIds.length} posição(ões) associada(s)`
                            : "Nenhuma posição associada"}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="numeric font-semibold">{percentage(line.actualWeight)}</p>
                        <p className="text-muted-foreground">
                          meta {percentage(line.targetWeight)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="relative mt-5 h-2 rounded-full bg-muted"
                      aria-label={`Atual ${percentage(line.actualWeight)}; meta ${percentage(line.targetWeight)}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-foreground/20"
                        style={{ width: clampPercentage(line.actualWeight) }}
                      />
                      <span
                        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
                        style={{ left: clampPercentage(line.actualWeight) }}
                      />
                      <span
                        className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 bg-primary"
                        style={{ left: clampPercentage(line.targetWeight) }}
                      />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="mr-1 inline-block h-2 w-0.5 bg-primary" /> marca = meta
                      </p>
                      <p className="text-right text-xs">
                        Próximo aporte: <strong>{formatBRL(line.suggestedContribution)}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Carteira observada</p>
                  <p className="numeric mt-1 font-semibold">{formatBRL(progress.actualTotal)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Aporte mensal do plano</p>
                  <p className="numeric mt-1 font-semibold">
                    {formatBRL(progress.targetMonthlyContribution)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Fora das metas reconhecidas</p>
                  <p className="numeric mt-1 font-semibold">
                    {percentage(progress.unmatchedWeight)}
                  </p>
                </div>
              </div>

              {history.data && history.data.length > 0 && (
                <div className="mt-5 border-t border-border/60 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Histórico de desvio</p>
                      <p className="text-xs text-muted-foreground">
                        Últimas {history.data.length} análises
                      </p>
                    </div>
                    <Target className="size-4 text-muted-foreground" />
                  </div>
                  <div
                    className="mt-4 flex h-16 items-end gap-1"
                    aria-label="Histórico do desvio do plano"
                  >
                    {history.data.map((item) => (
                      <div
                        key={item.date}
                        title={`${item.date}: ${item.drift.toLocaleString("pt-BR")} p.p.`}
                        className={cn(
                          "min-h-1 flex-1 rounded-t-sm",
                          item.status === "aligned"
                            ? "bg-success"
                            : item.status === "attention"
                              ? "bg-warning"
                              : "bg-danger",
                        )}
                        style={{ height: `${Math.max(8, Math.min(100, item.drift * 4))}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="size-5" /> Alertas de investimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <Label htmlFor="investment-alerts-enabled">Monitoramento diário</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Avalia o Radar e a aderência dos planos uma vez ao dia.
                </p>
              </div>
              <Switch
                id="investment-alerts-enabled"
                checked={draft.enabled}
                onCheckedChange={(enabled) => setDraft((value) => ({ ...value, enabled }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <Label htmlFor="investment-in-app">Criar insights no aplicativo</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alertas aparecem na tela de Insights e podem ser arquivados.
                </p>
              </div>
              <Switch
                id="investment-in-app"
                checked={draft.inAppEnabled}
                onCheckedChange={(inAppEnabled) =>
                  setDraft((value) => ({ ...value, inAppEnabled }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="minimum-score">Nota mínima</Label>
                <Input
                  id="minimum-score"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.minimumScore}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, minimumScore: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="score-change">Variação da nota</Label>
                <Input
                  id="score-change"
                  type="number"
                  min={1}
                  max={50}
                  value={draft.scoreChangeThreshold}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      scoreChangeThreshold: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="drift-threshold">Desvio do plano</Label>
                <Input
                  id="drift-threshold"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.driftThreshold}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, driftThreshold: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maturity-alert-days">Avisar vencimento</Label>
                <Input
                  id="maturity-alert-days"
                  type="number"
                  min={1}
                  max={365}
                  value={draft.maturityAlertDays}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      maturityAlertDays: Number(event.target.value),
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">Antecedência em dias</p>
              </div>
            </div>
            {draft.lastEvaluatedAt && (
              <p className="text-xs text-muted-foreground">
                Última avaliação: {new Date(draft.lastEvaluatedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={savePreferences} disabled={updatePreferences.isPending}>
              {updatePreferences.isPending ? "Salvando…" : "Salvar alertas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
