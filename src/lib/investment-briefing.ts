import type { FgcExposureSummary } from "./fgc-exposure";
import type { MaturityLadder } from "./investment-maturity";
import type { InvestmentPlanProgress } from "./investment-progress";
import type { RankedPrivateOffer } from "./private-fixed-income";
import type { RankedOpportunity } from "./investment-radar";

export type InvestmentBriefingAction = {
  id: string;
  priority: "critical" | "high" | "medium" | "opportunity";
  orderScore: number;
  title: string;
  detail: string;
  metric: string;
  target: "portfolio" | "plans" | "offers" | "radar";
};

export type InvestmentBriefingInput = {
  fgc: FgcExposureSummary;
  maturities: MaturityLadder;
  planProgress: InvestmentPlanProgress[];
  topPrivateOffer?: RankedPrivateOffer;
  topPublicOpportunity?: RankedOpportunity;
  missingMetadataCount: number;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function buildInvestmentBriefing(input: InvestmentBriefingInput) {
  const actions: InvestmentBriefingAction[] = [];
  const overdue = input.maturities.items.filter((item) => item.status === "overdue");
  const upcoming = input.maturities.items.filter((item) => item.status === "upcoming");
  const exceeded = input.fgc.groups.find((group) => group.status === "exceeded");
  const attention = input.fgc.groups.find((group) => group.status === "attention");
  const offTrack = input.planProgress.find((progress) => progress.status === "off_track");
  const planAttention = input.planProgress.find((progress) => progress.status === "attention");

  if (overdue.length > 0) {
    const total = overdue.reduce((sum, item) => sum + item.marketValue, 0);
    actions.push({
      id: "maturity-overdue",
      priority: "critical",
      orderScore: 100,
      title: "Confirmar posições já vencidas",
      detail: `${overdue.length} posição(ões) passaram da data cadastrada. Confirme liquidação e disponibilidade na instituição.`,
      metric: currency.format(total),
      target: "portfolio",
    });
  }
  if (exceeded) {
    actions.push({
      id: `fgc-exceeded:${exceeded.conglomerate}`,
      priority: "critical",
      orderScore: 95,
      title: `Revisar concentração em ${exceeded.conglomerate}`,
      detail: "A exposição registrada ultrapassa a referência ordinária do FGC por conglomerado.",
      metric: `${currency.format(exceeded.uncoveredAmount)} acima`,
      target: "portfolio",
    });
  } else if (attention) {
    actions.push({
      id: `fgc-attention:${attention.conglomerate}`,
      priority: "high",
      orderScore: 82,
      title: `Revisar margem FGC em ${attention.conglomerate}`,
      detail:
        "A exposição está acima de 80% da referência ordinária antes de qualquer novo aporte.",
      metric: `${Math.round(attention.utilization * 100)}% utilizado`,
      target: "portfolio",
    });
  }
  if (upcoming.length > 0) {
    const next = upcoming[0]!;
    actions.push({
      id: "maturity-upcoming",
      priority: "high",
      orderScore: 78,
      title: `Preparar vencimento de ${next.ticker}`,
      detail: `${upcoming.length} posição(ões) entram na janela configurada de alerta. Não há reinvestimento automático.`,
      metric: next.daysUntilMaturity === 0 ? "Hoje" : `${next.daysUntilMaturity} dias`,
      target: "portfolio",
    });
  }
  if (offTrack) {
    actions.push({
      id: `plan-off-track:${offTrack.planId}`,
      priority: "high",
      orderScore: 74,
      title: `Reequilibrar o próximo aporte de ${offTrack.planName}`,
      detail:
        "O plano está fora do alvo; priorize posições abaixo da meta antes de considerar vendas.",
      metric: `${offTrack.overallDrift.toLocaleString("pt-BR")} p.p.`,
      target: "plans",
    });
  } else if (planAttention) {
    actions.push({
      id: `plan-attention:${planAttention.planId}`,
      priority: "medium",
      orderScore: 58,
      title: `Acompanhar desvio de ${planAttention.planName}`,
      detail:
        "O plano entrou na faixa de atenção e pode ser corrigido gradualmente pelos próximos aportes.",
      metric: `${planAttention.overallDrift.toLocaleString("pt-BR")} p.p.`,
      target: "plans",
    });
  }
  if (input.missingMetadataCount > 0) {
    actions.push({
      id: "missing-metadata",
      priority: "medium",
      orderScore: 52,
      title: "Completar dados da carteira",
      detail:
        "Vencimento ou conglomerado ausente reduz a precisão dos alertas de liquidez e cobertura.",
      metric: `${input.missingMetadataCount} pendência(s)`,
      target: "portfolio",
    });
  }
  if (input.topPrivateOffer?.eligible) {
    actions.push({
      id: `private-offer:${input.topPrivateOffer.id}`,
      priority: "opportunity",
      orderScore: 35,
      title: `Revisar ${input.topPrivateOffer.productType.toUpperCase()} de ${input.topPrivateOffer.institution}`,
      detail:
        "Oferta privada válida pelos critérios atuais. Confirme taxa, disponibilidade e emissor na origem.",
      metric: `${(input.topPrivateOffer.netAnnualRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% líquido a.a.`,
      target: "offers",
    });
  }
  if (input.topPublicOpportunity) {
    actions.push({
      id: `public-opportunity:${input.topPublicOpportunity.id}`,
      priority: "opportunity",
      orderScore: 30,
      title: `Consultar ${input.topPublicOpportunity.name}`,
      detail:
        "Primeiro colocado do Radar público para o perfil atual; confirme preço e suitability antes de investir.",
      metric: `${input.topPublicOpportunity.score}/100`,
      target: "radar",
    });
  }

  return actions.sort((left, right) => right.orderScore - left.orderScore).slice(0, 7);
}
