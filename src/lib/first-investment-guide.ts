import type { FinancialReadiness } from "@/lib/financial-next-step";
import type {
  InvestmentObjective,
  InvestmentProfile,
  LiquidityPreference,
} from "@/lib/investment-radar";

export const FLUCTUATION_TOLERANCES = ["avoid", "some", "high"] as const;
export type FluctuationTolerance = (typeof FLUCTUATION_TOLERANCES)[number];

export const INVESTMENT_KNOWLEDGE_LEVELS = ["none", "basic", "experienced"] as const;
export type InvestmentKnowledgeLevel = (typeof INVESTMENT_KNOWLEDGE_LEVELS)[number];

export type FirstInvestmentAnswers = {
  objective: InvestmentObjective;
  horizonMonths: number;
  liquidityPreference: LiquidityPreference;
  fluctuationTolerance: FluctuationTolerance;
  knowledgeLevel: InvestmentKnowledgeLevel;
};

export type GuidanceReadiness = "organize" | "protect" | "ready";

export type EducationalInvestmentPath = {
  id: "liquid_reserve" | "fixed_term" | "gradual_diversification";
  title: string;
  eyebrow: string;
  reason: string;
  risk: string;
  liquidity: string;
  costs: string;
  whatCanGoWrong: string;
  nextCheck: string;
  source: { label: string; url: string };
};

export type FirstInvestmentGuidance = {
  readiness: GuidanceReadiness;
  title: string;
  explanation: string;
  prerequisite: {
    label: string;
    href: FinancialReadiness["href"];
  } | null;
  profile: InvestmentProfile;
  paths: EducationalInvestmentPath[];
  disclaimer: string;
};

const INVESTOR_PORTAL = "https://www.gov.br/investidor/pt-br/investir/antes-de-investir";

function deriveProfile(answers: FirstInvestmentAnswers): InvestmentProfile {
  const riskProfile =
    answers.fluctuationTolerance === "avoid" || answers.knowledgeLevel === "none"
      ? "conservative"
      : answers.fluctuationTolerance === "some" || answers.knowledgeLevel === "basic"
        ? "moderate"
        : "aggressive";

  return {
    riskProfile,
    horizonMonths: answers.horizonMonths,
    liquidityPreference: answers.liquidityPreference,
    objective: answers.objective,
  };
}

function readinessGate(financial: FinancialReadiness): GuidanceReadiness {
  if (financial.stage === "organize" || financial.stage === "economize") return "organize";
  if (financial.stage === "protect") return "protect";
  return "ready";
}

function liquidPath(answers: FirstInvestmentAnswers): EducationalInvestmentPath {
  return {
    id: "liquid_reserve",
    eyebrow: "Liquidez em primeiro lugar",
    title: "Reserva com baixo risco e acesso simples",
    reason:
      answers.objective === "reserve"
        ? "Seu objetivo é proteger o orçamento de imprevistos, então acesso ao dinheiro pesa mais que buscar retorno."
        : "Você informou que pode precisar do dinheiro rapidamente; por isso a liquidez vem antes do prazo.",
    risk:
      "Baixo não significa zero: verifique risco de crédito, regras de resgate e eventual oscilação antes do vencimento.",
    liquidity: "Procure alternativas com resgate compatível com a urgência do seu objetivo.",
    costs:
      "Compare imposto, IOF em resgates muito curtos, taxas da instituição e, quando aplicável, custódia.",
    whatCanGoWrong:
      "O resgate pode não cair no mesmo instante, a rentabilidade pode mudar e garantias têm condições e limites.",
    nextCheck: "Na instituição, confirme prazo de resgate, tributação, emissor e proteção aplicável.",
    source: {
      label: "Portal do Investidor — características dos investimentos",
      url: `${INVESTOR_PORTAL}/entenda-as-caracteristicas-dos-investimentos`,
    },
  };
}

function fixedTermPath(answers: FirstInvestmentAnswers): EducationalInvestmentPath {
  return {
    id: "fixed_term",
    eyebrow: "Prazo conhecido",
    title: "Renda fixa alinhada à data do objetivo",
    reason: `Seu horizonte de ${answers.horizonMonths} meses permite comparar vencimentos próximos da data em que pretende usar o dinheiro.`,
    risk:
      "Há risco do emissor e alguns títulos oscilam se forem vendidos antes do vencimento, mesmo sendo renda fixa.",
    liquidity:
      "Pode haver carência ou perda pela venda antecipada; o vencimento deve combinar com o objetivo.",
    costs:
      "Compare tributação, taxas, preço de saída antecipada e se há cobertura do FGC — ela não vale para todo produto.",
    whatCanGoWrong:
      "Precisar do dinheiro antes do prazo pode reduzir o resultado; o emissor também pode não honrar o pagamento.",
    nextCheck: "Compare vencimento, emissor, liquidez, tributação e cobertura antes de aplicar.",
    source: {
      label: "Portal do Investidor — objetivo, prazo, liquidez e risco",
      url: `${INVESTOR_PORTAL}/defina-seus-objetivos/qual-o-melhor-investimento`,
    },
  };
}

function diversificationPath(): EducationalInvestmentPath {
  return {
    id: "gradual_diversification",
    eyebrow: "Longo prazo, passo a passo",
    title: "Diversificação gradual entre classes",
    reason:
      "Sua base financeira, prazo e tolerância permitem estudar uma pequena parcela com oscilação, sem concentrar todo o dinheiro.",
    risk:
      "O valor pode cair e permanecer abaixo do aplicado por bastante tempo; diversificar reduz alguns riscos, mas não os elimina.",
    liquidity:
      "Ativos negociados podem ter liquidez, porém vender em queda transforma a oscilação em perda.",
    costs:
      "Verifique administração, corretagem, spread, tributação e custos do veículo usado para diversificar.",
    whatCanGoWrong:
      "Oscilações, concentração escondida e decisões por impulso podem afastar o resultado do objetivo.",
    nextCheck: "Comece estudando a classe, o índice ou a estratégia e limite a parcela que aceita ver oscilar.",
    source: {
      label: "Portal do Investidor — diversificação e risco",
      url: "https://www.gov.br/investidor/pt-br/investir/cuidados-ao-investir/evitando-problemas",
    },
  };
}

export function buildFirstInvestmentGuidance(
  financial: FinancialReadiness,
  answers: FirstInvestmentAnswers,
): FirstInvestmentGuidance {
  const readiness = readinessGate(financial);
  const profile = deriveProfile(answers);
  const disclaimer =
    "Orientação educacional baseada nos dados informados. Não é recomendação individual, garantia de retorno nem substitui o suitability da instituição.";

  if (readiness !== "ready") {
    return {
      readiness,
      title:
        readiness === "organize"
          ? "Organize esta parte antes de investir"
          : "Complete sua proteção antes de escolher produtos",
      explanation: financial.description,
      prerequisite: { label: financial.ctaLabel, href: financial.href },
      profile,
      paths: [],
      disclaimer,
    };
  }

  const paths: EducationalInvestmentPath[] = [];
  if (
    answers.objective === "reserve" ||
    answers.liquidityPreference === "daily" ||
    answers.horizonMonths <= 12
  ) {
    paths.push(liquidPath(answers));
  }
  if (answers.horizonMonths >= 12) paths.push(fixedTermPath(answers));
  if (
    answers.horizonMonths >= 60 &&
    answers.fluctuationTolerance !== "avoid" &&
    answers.knowledgeLevel !== "none" &&
    answers.objective !== "reserve"
  ) {
    paths.push(diversificationPath());
  }
  if (paths.length === 0) paths.push(liquidPath(answers));

  return {
    readiness,
    title: paths.length === 1 ? "Um caminho para estudar com calma" : "Caminhos para você explorar",
    explanation:
      "Eles foram filtrados pela sua situação financeira, objetivo, prazo, liquidez, tolerância e conhecimento.",
    prerequisite: null,
    profile,
    paths: paths.slice(0, 3),
    disclaimer,
  };
}
