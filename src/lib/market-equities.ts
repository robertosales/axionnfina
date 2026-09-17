import type { InvestmentProfile, InvestmentRadarContext, RadarEvidence } from "./investment-radar";

export type EquityKind = "etf" | "fii";

export type CuratedAsset = {
  ticker: string;
  name: string;
  kind: EquityKind;
  /** Nível de oscilação esperado, na mesma escala 1-5 usada na renda fixa. */
  riskLevel: 1 | 2 | 3 | 4 | 5;
  /** Prazo mínimo em meses a partir do qual o ativo costuma fazer sentido. */
  minimumHorizonMonths: number;
  whatItIs: string;
  whatCanGoWrong: string;
  costs: string;
  taxes: string;
  suitableFor: string;
};

export type EquityQuote = {
  ticker: string;
  price: number | null;
  changePercent: number | null;
  change12mPercent: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  referenceDate: string;
  source: string;
  sourceUrl: string;
};

export type EquityOpportunity = CuratedAsset & {
  quote: EquityQuote | null;
  score: number;
  fit: "high" | "medium" | "low";
  summary: string;
  evidence: RadarEvidence[];
  warnings: string[];
  /** Quando verdadeiro, o ativo aparece apenas para estudo, com o motivo explicado. */
  studyOnly: boolean;
  studyReason: string | null;
};

export type MarketIndexSnapshot = {
  id: "ibovespa" | "usdbrl";
  label: string;
  value: number | null;
  changePercent: number | null;
  unit: "pontos" | "R$";
};

export type MarketOverview = {
  referenceDate: string;
  source: string;
  sourceUrl: string;
  indices: MarketIndexSnapshot[];
  summary: string;
};

/**
 * Lista curada e fixa. Só entram ETFs de índice e fundos imobiliários muito
 * negociados, para evitar sugerir ativo ilíquido a quem está começando.
 */
export const CURATED_ASSETS: readonly CuratedAsset[] = [
  {
    ticker: "BOVA11",
    name: "BOVA11 — ETF do Ibovespa",
    kind: "etf",
    riskLevel: 4,
    minimumHorizonMonths: 36,
    whatItIs:
      "Fundo negociado na bolsa que compra, de uma vez só, as ações que formam o Ibovespa. Com uma cota você fica exposto às maiores empresas do Brasil.",
    whatCanGoWrong:
      "Acompanha a bolsa brasileira para cima e para baixo. Quedas de 20% ou mais em um ano já aconteceram várias vezes.",
    costs: "Taxa de administração em torno de 0,10% ao ano, mais o custo de corretagem da sua corretora.",
    taxes: "15% sobre o lucro na venda. Não há isenção de R$ 20 mil para ETFs.",
    suitableFor: "Quem quer começar na bolsa sem escolher ações uma a uma e pode deixar o dinheiro parado por anos.",
  },
  {
    ticker: "IVVB11",
    name: "IVVB11 — ETF do S&P 500",
    kind: "etf",
    riskLevel: 4,
    minimumHorizonMonths: 48,
    whatItIs:
      "Segue as 500 maiores empresas dos Estados Unidos, negociado em reais aqui na B3. Serve para não deixar todo o dinheiro preso a um país só.",
    whatCanGoWrong:
      "Soma dois riscos: a bolsa americana e o câmbio. Se o dólar cair, o resultado em reais piora mesmo com as empresas indo bem.",
    costs: "Taxa de administração em torno de 0,23% ao ano, mais corretagem.",
    taxes: "15% sobre o lucro na venda.",
    suitableFor: "Quem já tem reserva formada e quer diversificar para fora do Brasil.",
  },
  {
    ticker: "IMAB11",
    name: "IMAB11 — ETF de Tesouro IPCA+",
    kind: "etf",
    riskLevel: 3,
    minimumHorizonMonths: 36,
    whatItIs:
      "Reúne títulos públicos atrelados à inflação em uma cota só. É renda fixa, mas com o preço oscilando todo dia como uma ação.",
    whatCanGoWrong:
      "Quando os juros sobem, o preço da cota cai. Oscila menos que a bolsa, porém bem mais que o Tesouro Selic.",
    costs: "Taxa de administração em torno de 0,25% ao ano, mais corretagem.",
    taxes: "15% sobre o lucro na venda.",
    suitableFor: "Quem quer proteção contra a inflação e aceita ver o valor variar no caminho.",
  },
  {
    ticker: "SMAL11",
    name: "SMAL11 — ETF de empresas menores",
    kind: "etf",
    riskLevel: 5,
    minimumHorizonMonths: 60,
    whatItIs: "Reúne empresas de menor porte listadas na bolsa brasileira.",
    whatCanGoWrong:
      "É o mais instável da lista. Empresas menores sofrem muito mais em crises e a recuperação pode demorar anos.",
    costs: "Taxa de administração em torno de 0,50% ao ano, mais corretagem.",
    taxes: "15% sobre o lucro na venda.",
    suitableFor: "Apenas para quem aceita risco alto e tem prazo muito longo.",
  },
  {
    ticker: "MXRF11",
    name: "MXRF11 — Fundo imobiliário de papel",
    kind: "fii",
    riskLevel: 4,
    minimumHorizonMonths: 36,
    whatItIs:
      "Fundo imobiliário que investe em títulos de dívida do setor de imóveis e distribui rendimento quase todo mês. A cota costuma custar poucos reais.",
    whatCanGoWrong:
      "O rendimento não é garantido e pode cair. O preço da cota varia e calotes nos títulos afetam o fundo.",
    costs: "Taxas do fundo já descontadas do rendimento, mais corretagem na compra.",
    taxes: "Rendimento mensal isento de imposto para pessoa física, mas o lucro na venda da cota paga 20%.",
    suitableFor: "Quem quer entender renda mensal começando com valores pequenos.",
  },
  {
    ticker: "HGLG11",
    name: "HGLG11 — Fundo de galpões logísticos",
    kind: "fii",
    riskLevel: 4,
    minimumHorizonMonths: 48,
    whatItIs: "Dono de galpões alugados para empresas de logística e indústria; repassa os aluguéis aos cotistas.",
    whatCanGoWrong:
      "Se inquilinos saírem (vacância) ou renegociarem aluguel, o rendimento cai. O preço da cota também oscila com os juros.",
    costs: "Taxas de administração e gestão descontadas do fundo, mais corretagem.",
    taxes: "Rendimento mensal isento para pessoa física; 20% sobre o lucro na venda da cota.",
    suitableFor: "Quem busca renda mensal com imóveis e tem prazo longo.",
  },
  {
    ticker: "KNRI11",
    name: "KNRI11 — Fundo de lajes e galpões",
    kind: "fii",
    riskLevel: 4,
    minimumHorizonMonths: 48,
    whatItIs: "Carteira de escritórios e galpões de vários inquilinos, uma das mais antigas do mercado.",
    whatCanGoWrong: "Escritórios vazios reduzem o aluguel recebido e a cota pode ficar anos abaixo do preço pago.",
    costs: "Taxas do fundo descontadas do rendimento, mais corretagem.",
    taxes: "Rendimento mensal isento para pessoa física; 20% sobre o lucro na venda da cota.",
    suitableFor: "Quem quer diversificar a renda mensal entre tipos de imóvel.",
  },
  {
    ticker: "XPML11",
    name: "XPML11 — Fundo de shopping centers",
    kind: "fii",
    riskLevel: 4,
    minimumHorizonMonths: 48,
    whatItIs: "Participações em shoppings espalhados pelo país; o aluguel das lojas vira rendimento mensal.",
    whatCanGoWrong: "Depende do consumo. Em recessão as lojas vendem menos, pedem desconto e o rendimento encolhe.",
    costs: "Taxas do fundo descontadas do rendimento, mais corretagem.",
    taxes: "Rendimento mensal isento para pessoa física; 20% sobre o lucro na venda da cota.",
    suitableFor: "Quem aceita ligar parte da renda ao consumo das famílias.",
  },
] as const;

export const EQUITY_TICKERS: readonly string[] = CURATED_ASSETS.map((asset) => asset.ticker);

/** Frase curta e sem jargão sobre o dia, sempre relativizando a oscilação diária. */
export function describeMarketDay(indices: MarketIndexSnapshot[]): string {
  const ibov = indices.find((index) => index.id === "ibovespa");
  if (!ibov || ibov.changePercent == null) {
    return "Não foi possível confirmar o fechamento do dia. Um dia isolado, de qualquer forma, não deve guiar decisões de longo prazo.";
  }
  const move = ibov.changePercent;
  const direction =
    move > 1
      ? "A bolsa brasileira subiu com força hoje"
      : move > 0.15
        ? "A bolsa brasileira subiu hoje"
        : move < -1
          ? "A bolsa brasileira caiu com força hoje"
          : move < -0.15
            ? "A bolsa brasileira caiu hoje"
            : "A bolsa brasileira ficou praticamente estável hoje";
  return `${direction}. Oscilações diárias são normais e não devem guiar decisões de longo prazo.`;
}

export function reserveIsFormed(context: InvestmentRadarContext): boolean {
  return context.reserveMonths != null && context.reserveMonths >= 3;
}

export function effectiveHorizonMonths(
  profile: InvestmentProfile,
  context: InvestmentRadarContext,
): number {
  if (profile.objective === "retirement" || context.nearestGoalMonths == null) {
    return profile.horizonMonths;
  }
  return Math.min(profile.horizonMonths, context.nearestGoalMonths);
}
