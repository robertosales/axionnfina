import {
  describeMarketDay,
  effectiveHorizonMonths,
  reserveIsFormed,
  type CuratedAsset,
  type EquityOpportunity,
  type EquityQuote,
  type MarketIndexSnapshot,
  type MarketOverview,
} from "./market-equities";
import type { InvestmentProfile, InvestmentRadarContext, RadarEvidence } from "./investment-radar";

function riskLimit(profile: InvestmentProfile): number {
  if (profile.riskProfile === "aggressive") return 5;
  if (profile.riskProfile === "moderate") return 4;
  return 2;
}

function objectivePoints(asset: CuratedAsset, profile: InvestmentProfile): number {
  switch (profile.objective) {
    case "reserve":
      return -30;
    case "growth":
      return asset.kind === "etf" ? 16 : 8;
    case "retirement":
      return asset.kind === "fii" ? 16 : 14;
    case "education":
      return asset.ticker === "IMAB11" ? 12 : 4;
    default:
      return 0;
  }
}

export function buildMarketOverview(
  indices: MarketIndexSnapshot[],
  referenceDate: string,
  source: string,
  sourceUrl: string,
): MarketOverview {
  return {
    referenceDate,
    source,
    sourceUrl,
    indices,
    summary: describeMarketDay(indices),
  };
}

/**
 * Ranking educacional de renda variável. A pontuação nunca usa desempenho
 * passado como critério: só perfil, prazo, objetivo, custo e proteção. O
 * retorno de 12 meses entra como informação neutra para contexto.
 */
export function rankEquityOpportunities(
  assets: readonly CuratedAsset[],
  quotes: Map<string, EquityQuote>,
  profile: InvestmentProfile,
  context: InvestmentRadarContext,
): EquityOpportunity[] {
  const maxRisk = riskLimit(profile);
  const horizon = effectiveHorizonMonths(profile, context);
  const reserveOk = reserveIsFormed(context);

  return assets
    .map((asset): EquityOpportunity => {
      const quote = quotes.get(asset.ticker) ?? null;
      const evidence: RadarEvidence[] = [];

      const riskGap = maxRisk - asset.riskLevel;
      evidence.push({
        label: "Risco",
        detail:
          riskGap >= 0
            ? `Oscilação nível ${asset.riskLevel}/5, dentro do que seu perfil aceita.`
            : `Oscilação nível ${asset.riskLevel}/5, acima do que seu perfil declarou aceitar.`,
        impact: riskGap >= 0 ? "positive" : "warning",
        points: riskGap >= 0 ? 20 - Math.min(riskGap, 3) * 3 : -22 * Math.abs(riskGap),
      });

      const horizonOk = horizon >= asset.minimumHorizonMonths;
      evidence.push({
        label: "Prazo",
        detail: horizonOk
          ? `Seu horizonte de ${horizon} meses cobre o mínimo sugerido de ${asset.minimumHorizonMonths} meses.`
          : `Seu horizonte de ${horizon} meses é menor que os ${asset.minimumHorizonMonths} meses sugeridos para este ativo.`,
        impact: horizonOk ? "positive" : "warning",
        points: horizonOk ? 20 : -24,
      });

      const liquidityOk = profile.liquidityPreference !== "daily";
      evidence.push({
        label: "Liquidez",
        detail: liquidityOk
          ? "Vende na bolsa em qualquer pregão, com o dinheiro na conta em poucos dias."
          : "Vende rápido, mas pode ser obrigado a vender em queda se precisar do dinheiro de repente.",
        impact: liquidityOk ? "positive" : "warning",
        points: liquidityOk ? 12 : -12,
      });

      const objective = objectivePoints(asset, profile);
      evidence.push({
        label: "Objetivo",
        detail:
          objective >= 12
            ? "Combina com o objetivo que você escolheu."
            : objective > 0
              ? "Pode complementar o objetivo escolhido."
              : "Não combina com o objetivo escolhido; para reserva de emergência, prefira renda fixa com liquidez diária.",
        impact: objective >= 12 ? "positive" : objective > 0 ? "neutral" : "warning",
        points: objective,
      });

      evidence.push({
        label: "Base financeira",
        detail: reserveOk
          ? `Reserva estimada em ${context.reserveMonths?.toFixed(1)} meses de despesas.`
          : "Reserva de emergência ainda não está formada (menos de 3 meses de despesas).",
        impact: reserveOk ? "positive" : "warning",
        points: reserveOk ? 12 : -30,
      });

      evidence.push({
        label: "Proteção",
        detail: "Não tem garantia do FGC. Em caso de queda, não existe cobertura de ninguém.",
        impact: "neutral",
        points: 0,
      });

      if (quote?.change12mPercent != null) {
        evidence.push({
          label: "Últimos 12 meses",
          detail: `Variação de ${quote.change12mPercent.toFixed(1)}% no período. Informação de contexto: resultado passado não indica resultado futuro e não entra na nota.`,
          impact: "neutral",
          points: 0,
        });
      }

      const score = Math.max(
        0,
        Math.min(100, Math.round(40 + evidence.reduce((sum, item) => sum + item.points, 0))),
      );
      const fit = score >= 75 ? "high" : score >= 50 ? "medium" : "low";

      const studyOnly = !reserveOk || profile.objective === "reserve" || !horizonOk;
      const studyReason = !reserveOk
        ? "Só faz sentido depois que sua reserva de emergência cobrir pelo menos 3 meses de despesas."
        : profile.objective === "reserve"
          ? "Seu objetivo atual é reserva de emergência, que pede dinheiro seguro e disponível."
          : !horizonOk
            ? "Seu prazo é curto demais para este ativo; o risco de precisar vender em queda é alto."
            : null;

      const warnings = [
        "O valor investido pode cair e ficar abaixo do que você pagou.",
        "Sem garantia do FGC e sem rentabilidade prometida.",
        ...(asset.kind === "fii"
          ? ["O rendimento mensal pode diminuir ou deixar de ser pago."]
          : []),
        ...(quote == null ? ["Cotação indisponível agora; os números não foram exibidos."] : []),
      ];

      return {
        ...asset,
        quote,
        score,
        fit,
        summary: studyOnly
          ? "Apenas para estudo neste momento."
          : fit === "high"
            ? "Boa aderência ao seu perfil e prazo."
            : fit === "medium"
              ? "Aderência parcial; leia os riscos com calma."
              : "Baixa aderência ao seu perfil.",
        evidence,
        warnings,
        studyOnly,
        studyReason,
      };
    })
    .sort((a, b) => Number(a.studyOnly) - Number(b.studyOnly) || b.score - a.score);
}
