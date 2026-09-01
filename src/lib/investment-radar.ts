export const RISK_PROFILES = ["conservative", "moderate", "aggressive"] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export const LIQUIDITY_PREFERENCES = ["daily", "up_to_1_year", "long_term"] as const;
export type LiquidityPreference = (typeof LIQUIDITY_PREFERENCES)[number];

export const INVESTMENT_OBJECTIVES = ["reserve", "growth", "retirement", "education"] as const;
export type InvestmentObjective = (typeof INVESTMENT_OBJECTIVES)[number];

export type InvestmentProfile = {
  riskProfile: RiskProfile;
  horizonMonths: number;
  liquidityPreference: LiquidityPreference;
  objective: InvestmentObjective;
};

export type InvestmentRadarContext = {
  reserveMonths: number | null;
  monthlyExpenses: number;
  liquidBalance: number;
  nearestGoalMonths: number | null;
};

export type MarketIndicator = {
  id: "selic" | "ipca12m";
  label: string;
  value: number;
  unit: "% a.a.";
  referenceDate: string;
  source: "Banco Central do Brasil";
  sourceUrl: string;
};

export type TreasuryOpportunity = {
  id: string;
  name: string;
  issuer: "Tesouro Nacional";
  indexer: "selic" | "fixed" | "ipca" | "igpm";
  maturityDate: string;
  referenceDate: string;
  purchaseRate: number;
  purchasePrice: number;
  minimumInvestment: number;
  liquidityDays: number;
  riskLevel: 1 | 2 | 3 | 4 | 5;
  hasCoupons: boolean;
  source: "Tesouro Transparente";
  sourceUrl: string;
};

export type RadarEvidence = {
  label: string;
  detail: string;
  impact: "positive" | "neutral" | "warning";
  points: number;
};

export type RankedOpportunity = TreasuryOpportunity & {
  score: number;
  fit: "high" | "medium" | "low";
  rateLabel: string;
  summary: string;
  evidence: RadarEvidence[];
  warnings: string[];
};

export type InvestmentRadarResponse = {
  generatedAt: string;
  referenceDate: string;
  cacheStatus: "fresh" | "cached" | "stale";
  profile: InvestmentProfile;
  context: InvestmentRadarContext;
  indicators: MarketIndicator[];
  opportunities: RankedOpportunity[];
  sourceHealth: Array<{
    source: string;
    status: "available" | "unavailable";
    detail: string;
  }>;
  disclaimer: string;
};

export const TREASURY_SOURCE_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv";

const HEADER = [
  "Tipo Titulo",
  "Data Vencimento",
  "Data Base",
  "Taxa Compra Manha",
  "Taxa Venda Manha",
  "PU Compra Manha",
  "PU Venda Manha",
  "PU Base Manha",
] as const;

function parseBrazilianNumber(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBrazilianDate(value: string): string {
  const [day, month, year] = value.trim().split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function classifyIndexer(name: string): TreasuryOpportunity["indexer"] {
  if (/selic/i.test(name)) return "selic";
  if (/ipca/i.test(name)) return "ipca";
  if (/igpm/i.test(name)) return "igpm";
  return "fixed";
}

function yearsUntil(isoDate: string, referenceDate: string): number {
  const maturity = new Date(`${isoDate}T12:00:00Z`).getTime();
  const reference = new Date(`${referenceDate}T12:00:00Z`).getTime();
  return Math.max(0, (maturity - reference) / (365.25 * 24 * 60 * 60 * 1000));
}

function riskFor(indexer: TreasuryOpportunity["indexer"], years: number): 1 | 2 | 3 | 4 | 5 {
  if (indexer === "selic") return years <= 3 ? 1 : 2;
  if (years <= 2) return 2;
  if (years <= 5) return 3;
  if (years <= 10) return 4;
  return 5;
}

/** Converte o primeiro bloco diario do CSV oficial do Tesouro em oportunidades. */
export function parseLatestTreasuryCsv(csv: string): TreasuryOpportunity[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const columns = lines[0]!.split(";").map((column) => column.trim());
  if (!HEADER.every((column, index) => columns[index] === column)) {
    throw new Error("Formato inesperado no arquivo do Tesouro Transparente.");
  }

  const firstReferenceDate = lines[1]!.split(";")[2];
  if (!firstReferenceDate) return [];

  const opportunities: TreasuryOpportunity[] = [];
  for (const line of lines.slice(1)) {
    const fields = line.split(";");
    if (fields.length < HEADER.length || fields[2] !== firstReferenceDate) break;

    const name = fields[0]?.trim() ?? "";
    const maturityDate = parseBrazilianDate(fields[1] ?? "");
    const referenceDate = parseBrazilianDate(fields[2] ?? "");
    if (!name || !maturityDate || !referenceDate) continue;

    const indexer = classifyIndexer(name);
    const years = yearsUntil(maturityDate, referenceDate);
    const purchasePrice = parseBrazilianNumber(fields[5] ?? "0");
    opportunities.push({
      id: `tesouro-${normalizeId(name)}-${maturityDate}`,
      name: `${name} ${maturityDate.slice(0, 4)}`,
      issuer: "Tesouro Nacional",
      indexer,
      maturityDate,
      referenceDate,
      purchaseRate: parseBrazilianNumber(fields[3] ?? "0"),
      purchasePrice,
      minimumInvestment: Math.max(30, Math.round(purchasePrice * 0.01 * 100) / 100),
      liquidityDays: 0,
      riskLevel: riskFor(indexer, years),
      hasCoupons: /juros semestrais/i.test(name),
      source: "Tesouro Transparente",
      sourceUrl: TREASURY_SOURCE_URL,
    });
  }

  return opportunities;
}

function riskLimit(profile: RiskProfile): number {
  if (profile === "aggressive") return 5;
  if (profile === "moderate") return 4;
  return 2;
}

function rateLabel(opportunity: TreasuryOpportunity, selic?: number): string {
  if (opportunity.indexer === "selic") {
    const spread = opportunity.purchaseRate;
    const spreadLabel = `${spread >= 0 ? "+ " : "- "}${Math.abs(spread).toFixed(2)}%`;
    return selic ? `Selic (${selic.toFixed(2)}%) ${spreadLabel}` : `Selic ${spreadLabel}`;
  }
  if (opportunity.indexer === "ipca") return `IPCA + ${opportunity.purchaseRate.toFixed(2)}%`;
  if (opportunity.indexer === "igpm") return `IGP-M + ${opportunity.purchaseRate.toFixed(2)}%`;
  return `${opportunity.purchaseRate.toFixed(2)}% a.a.`;
}

function objectiveFit(opportunity: TreasuryOpportunity, objective: InvestmentObjective): number {
  if (objective === "reserve") return opportunity.indexer === "selic" ? 16 : -8;
  if (objective === "retirement") {
    if (/renda\+/i.test(opportunity.name)) return 16;
    return opportunity.indexer === "ipca" ? 10 : 0;
  }
  if (objective === "education") {
    if (/educa\+/i.test(opportunity.name)) return 16;
    return opportunity.indexer === "ipca" ? 9 : 0;
  }
  return opportunity.indexer === "ipca" || opportunity.indexer === "fixed" ? 6 : 2;
}

export function rankTreasuryOpportunities(
  opportunities: TreasuryOpportunity[],
  profile: InvestmentProfile,
  indicators: MarketIndicator[],
  context?: InvestmentRadarContext,
): RankedOpportunity[] {
  const selic = indicators.find((indicator) => indicator.id === "selic")?.value;
  const maxRisk = riskLimit(profile.riskProfile);

  return opportunities
    .map((opportunity): RankedOpportunity => {
      const monthsToMaturity = Math.max(
        1,
        Math.round(yearsUntil(opportunity.maturityDate, opportunity.referenceDate) * 12),
      );
      const effectiveHorizonMonths =
        profile.objective !== "retirement" && context?.nearestGoalMonths != null
          ? Math.min(profile.horizonMonths, context.nearestGoalMonths)
          : profile.horizonMonths;
      const evidence: RadarEvidence[] = [];

      if (context?.reserveMonths != null && context.reserveMonths < 3) {
        const reservePoints = opportunity.indexer === "selic" ? 18 : -12;
        evidence.push({
          label: "Base financeira",
          detail:
            opportunity.indexer === "selic"
              ? `Reserva estimada em ${context.reserveMonths.toFixed(1)} meses; liquidez recebe prioridade.`
              : `Reserva estimada em ${context.reserveMonths.toFixed(1)} meses; prazo longo perde prioridade.`,
          impact: opportunity.indexer === "selic" ? "positive" : "warning",
          points: reservePoints,
        });
      }

      const riskGap = maxRisk - opportunity.riskLevel;
      const riskPoints = riskGap >= 0 ? 24 - Math.min(riskGap, 3) * 2 : -18 * Math.abs(riskGap);
      evidence.push({
        label: "Risco",
        detail:
          riskGap >= 0
            ? `Nível ${opportunity.riskLevel}/5 compatível com o perfil.`
            : `Nível ${opportunity.riskLevel}/5 acima do limite do perfil.`,
        impact: riskGap >= 0 ? "positive" : "warning",
        points: riskPoints,
      });

      const horizonRatio = monthsToMaturity / Math.max(effectiveHorizonMonths, 1);
      const horizonPoints =
        horizonRatio <= 1.15 ? 22 : horizonRatio <= 1.8 ? 7 : -Math.min(45, horizonRatio * 10);
      evidence.push({
        label: "Prazo",
        detail:
          horizonRatio <= 1.15
            ? "Vencimento dentro do horizonte informado."
            : context?.nearestGoalMonths != null && profile.objective !== "retirement"
              ? "Vencimento supera o prazo da meta mais próxima; saída antecipada pode oscilar."
              : "Vencimento supera o horizonte; saída antecipada pode oscilar.",
        impact: horizonRatio <= 1.15 ? "positive" : "warning",
        points: Math.round(horizonPoints),
      });

      const dailyLiquidityMatch =
        profile.liquidityPreference !== "daily" || opportunity.indexer === "selic";
      const liquidityPoints = dailyLiquidityMatch ? 16 : -10;
      evidence.push({
        label: "Liquidez",
        detail: dailyLiquidityMatch
          ? "Liquidez compatível com a preferência declarada."
          : "Tem recompra diária, mas sofre marcação a mercado antes do vencimento.",
        impact: dailyLiquidityMatch ? "positive" : "warning",
        points: liquidityPoints,
      });

      const objectivePoints = objectiveFit(opportunity, profile.objective);
      evidence.push({
        label: "Objetivo",
        detail:
          objectivePoints >= 10
            ? "Estrutura alinhada ao objetivo selecionado."
            : objectivePoints > 0
              ? "Pode complementar o objetivo selecionado."
              : "Baixa aderência ao objetivo selecionado.",
        impact: objectivePoints >= 10 ? "positive" : objectivePoints > 0 ? "neutral" : "warning",
        points: objectivePoints,
      });

      const simplicityPoints = opportunity.hasCoupons ? 1 : 7;
      evidence.push({
        label: "Estrutura",
        detail: opportunity.hasCoupons
          ? "Cupons semestrais exigem planejamento de reinvestimento."
          : "Fluxo simples, sem cupons intermediários.",
        impact: opportunity.hasCoupons ? "neutral" : "positive",
        points: simplicityPoints,
      });

      const score = Math.max(
        0,
        Math.min(100, Math.round(25 + evidence.reduce((sum, item) => sum + item.points, 0))),
      );
      const fit = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
      const warnings = [
        ...(opportunity.indexer !== "selic"
          ? ["Venda antes do vencimento está sujeita à marcação a mercado."]
          : []),
        ...(opportunity.hasCoupons
          ? ["Cupons recebidos podem precisar ser reinvestidos para manter a estratégia."]
          : []),
      ];

      return {
        ...opportunity,
        score,
        fit,
        rateLabel: rateLabel(opportunity, selic),
        summary:
          fit === "high"
            ? "Boa aderência às preferências atuais."
            : fit === "medium"
              ? "Aderência parcial; revise prazo e risco."
              : "Baixa aderência ao perfil informado.",
        evidence,
        warnings,
      };
    })
    .sort((a, b) => b.score - a.score || a.riskLevel - b.riskLevel)
    .slice(0, 8);
}
