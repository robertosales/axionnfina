import { ArrowRight, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useInvestmentBriefing } from "./use-investment-briefing";

const priorityCopy = {
  critical: { label: "Resolver agora", tone: "border-danger/40 bg-danger/10 text-danger" },
  high: { label: "Alta prioridade", tone: "border-warning/40 bg-warning/10 text-warning" },
  medium: { label: "Revisar", tone: "border-primary/30 bg-primary/5 text-primary" },
  opportunity: { label: "Oportunidade", tone: "border-success/40 bg-success/10 text-success" },
} as const;

const targetCopy = {
  portfolio: "Abrir carteira",
  plans: "Revisar planos",
  offers: "Comparar ofertas",
  radar: "Ver Radar",
} as const;

export function InvestmentDecisionBriefing() {
  const { loading, failed, actions } = useInvestmentBriefing();

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <ListChecks className="size-3.5" /> Briefing de investimentos
          </div>
          <h2 className="text-lg font-semibold">Sua próxima decisão, em ordem</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Riscos e pendências vêm antes de oportunidades. Nenhuma ação financeira é executada
            automaticamente.
          </p>
        </div>
        {!loading && !failed && (
          <Badge variant="outline" className="rounded-full">
            {actions.length} ação(ões)
          </Badge>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Montando briefing com os dados atuais…</p>
        ) : failed ? (
          <p className="text-sm text-danger">Não foi possível consolidar o briefing.</p>
        ) : actions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5">
            <p className="text-sm font-medium">Nenhuma ação prioritária identificada.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre posições, planos ou ofertas para ampliar a análise.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-0 before:absolute before:bottom-6 before:left-[17px] before:top-6 before:w-px before:bg-border">
            {actions.map((action, index) => (
              <li
                key={action.id}
                className="relative grid gap-3 py-4 pl-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="numeric absolute left-0 top-5 z-10 flex size-9 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("rounded-full text-[10px]", priorityCopy[action.priority].tone)}
                    >
                      {priorityCopy[action.priority].label}
                    </Badge>
                    <span className="numeric text-xs font-semibold text-muted-foreground">
                      {action.metric}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{action.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {action.detail}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild className="w-fit">
                  <Link to="/investments">
                    {targetCopy[action.target]} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
