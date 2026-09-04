import type { RankedOpportunity } from "./investment-radar";
import type { RankedPrivateOffer } from "./private-fixed-income";

export type ComparisonSourceStatus = "verified" | "stale" | "incomplete";

export type InvestmentComparisonItem = {
  id: string;
  origin: "treasury" | "private";
  name: string;
  issuer: string;
  productLabel: string;
  remuneration: string;
  fitScore: number;
  fitLabel: "Maior aderência" | "Aderência parcial" | "Revisar antes";
  comparable: boolean;
  minimumInvestment: number;
  maturityDate: string;
  liquidity: string;
  risk: string;
  taxes: string;
  costs: string;
  protection: string;
  estimate: string | null;
  limitations: string[];
  source: {
    name: string;
    url: string | null;
    referenceDate: string;
    scope: string;
    status: ComparisonSourceStatus;
    statusLabel: string;
  };
};

const PRODUCT_LABEL = { cdb: "CDB", lci: "LCI", lca: "LCA" } as const;
const RATE_LABEL = { fixed: "Prefixado", cdi: "% do CDI", ipca: "IPCA +" } as const;

function validSourceUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function fitLabel(score: number): InvestmentComparisonItem["fitLabel"] {
  if (score >= 75) return "Maior aderência";
  if (score >= 50) return "Aderência parcial";
  return "Revisar antes";
}

function treasuryLiquidity(item: RankedOpportunity) {
  return item.indexer === "selic"
    ? "Recompra em dias úteis; confirme horário e prazo de liquidação."
    : "Há recompra, mas a venda antecipada ocorre pelo preço de mercado e pode gerar perda.";
}

function treasuryRisk(item: RankedOpportunity) {
  return item.indexer === "selic"
    ? "Risco soberano e pequena oscilação antes do vencimento."
    : `Risco soberano e oscilação de preço nível ${item.riskLevel}/5 antes do vencimento.`;
}

function privateTax(item: RankedPrivateOffer) {
  if (item.productType === "cdb") {
    return `Estimativa considera IR regressivo de ${(item.incomeTaxRate * 100).toLocaleString("pt-BR")}% sobre o rendimento; confirme a regra na contratação.`;
  }
  return "Estimativa considera isenção de IR para pessoa física nas regras atuais; confirme sua situação e a regra vigente na contratação.";
}

function fromTreasury(item: RankedOpportunity): InvestmentComparisonItem {
  return {
    id: item.id,
    origin: "treasury",
    name: item.name,
    issuer: item.issuer,
    productLabel: "Título público",
    remuneration: item.rateLabel,
    fitScore: item.score,
    fitLabel: fitLabel(item.score),
    comparable: true,
    minimumInvestment: item.minimumInvestment,
    maturityDate: item.maturityDate,
    liquidity: treasuryLiquidity(item),
    risk: treasuryRisk(item),
    taxes:
      "IR regressivo e possível IOF em resgates com menos de 30 dias; confirme as regras vigentes.",
    costs:
      "Pode haver custódia da B3 e taxa da instituição; confirme isenções e valores antes de investir.",
    protection: "Dívida do Tesouro Nacional. Não possui cobertura do FGC.",
    estimate: null,
    limitations: [
      ...item.warnings,
      "A taxa exibida é uma fotografia da data de referência e pode mudar antes da compra.",
      "Não há projeção líquida porque inflação futura, data de resgate e custos individuais podem variar.",
    ],
    source: {
      name: item.source,
      url: item.sourceUrl,
      referenceDate: item.referenceDate,
      scope: "Preços e taxas de compra dos títulos públicos disponíveis na data de referência.",
      status: "verified",
      statusLabel: "Fonte oficial",
    },
  };
}

function fromPrivate(item: RankedPrivateOffer): InvestmentComparisonItem {
  const hasSource = validSourceUrl(item.sourceUrl);
  const sourceStatus: ComparisonSourceStatus = !hasSource
    ? "incomplete"
    : item.fresh
      ? "verified"
      : "stale";
  const comparable = item.eligible && sourceStatus === "verified";
  const product = PRODUCT_LABEL[item.productType];
  const remuneration = `${RATE_LABEL[item.rateType]} ${item.rateValue.toLocaleString("pt-BR")}${item.rateType === "cdi" ? "%" : "% a.a."}`;

  return {
    id: item.id,
    origin: "private",
    name: `${product} · ${item.institution}`,
    issuer: item.conglomerate,
    productLabel: product,
    remuneration,
    fitScore: comparable ? item.score : 0,
    fitLabel: comparable ? fitLabel(item.score) : "Revisar antes",
    comparable,
    minimumInvestment: item.minimumInvestment,
    maturityDate: item.maturityDate,
    liquidity: item.dailyLiquidity
      ? "Liquidez diária informada; confirme horário, carência e prazo de crédito na origem."
      : "Resgate previsto no vencimento; confirme se existe saída antecipada e suas condições.",
    risk: "Risco de crédito da instituição emissora e do conglomerado informado.",
    taxes: privateTax(item),
    costs:
      "Custos não foram estruturados na oferta cadastrada; confirme taxas, spreads e penalidades na origem.",
    protection: item.fgcEligible
      ? "Produto marcado como elegível ao FGC. Confirme instituição associada, conglomerado, saldo total e limites."
      : "Oferta informada como não coberta pelo FGC.",
    estimate: comparable
      ? `Estimativa líquida no vencimento: ${item.projectedNetValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Não é garantia.`
      : null,
    limitations: [
      ...item.warnings,
      "Oferta cadastrada pelo usuário; disponibilidade e condições devem ser reconfirmadas na instituição.",
      "A estimativa usa a taxa de referência informada e não prevê mudanças futuras do CDI ou IPCA.",
    ],
    source: {
      name: item.institution,
      url: hasSource ? item.sourceUrl : null,
      referenceDate: item.sourceCheckedAt.slice(0, 10),
      scope: "Condições da oferta privada para o aporte, vencimento e taxa cadastrados.",
      status: sourceStatus,
      statusLabel:
        sourceStatus === "verified"
          ? "Origem informada"
          : sourceStatus === "stale"
            ? "Conferência vencida"
            : "Fonte incompleta",
    },
  };
}

export function buildInvestmentComparison(
  treasury: RankedOpportunity[],
  privateOffers: RankedPrivateOffer[],
): InvestmentComparisonItem[] {
  return [...treasury.map(fromTreasury), ...privateOffers.map(fromPrivate)].sort(
    (left, right) =>
      Number(right.comparable) - Number(left.comparable) ||
      right.fitScore - left.fitScore ||
      left.maturityDate.localeCompare(right.maturityDate),
  );
}
