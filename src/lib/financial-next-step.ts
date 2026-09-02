export const FINANCIAL_JOURNEY = [
  { id: "organize", label: "Organizar" },
  { id: "economize", label: "Economizar" },
  { id: "protect", label: "Proteger" },
  { id: "invest", label: "Investir" },
  { id: "track", label: "Acompanhar" },
] as const;

export type FinancialStage = (typeof FINANCIAL_JOURNEY)[number]["id"];
export type NextStepHref = "/wallet/connect" | "/bills" | "/budget" | "/goals" | "/investments";

type ReadinessAccount = {
  type: "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT";
  balance: number;
};

type ReadinessTransaction = {
  kind: "income" | "expense" | "transfer" | "investment";
  amount: number;
  date: string;
  category: string;
};

type ReadinessBill = {
  status: "SCHEDULED" | "PENDING" | "OVERDUE";
  amount: number;
};

type ReadinessGoal = { id: string };

export type FinancialReadinessInput = {
  accounts: ReadinessAccount[];
  transactions: ReadinessTransaction[];
  bills: ReadinessBill[];
  goals: ReadinessGoal[];
  investmentTotal: number;
  referenceDate?: string;
};

export type FinancialReadiness = {
  stage: FinancialStage;
  title: string;
  description: string;
  ctaLabel: string;
  href: NextStepHref;
  reasons: string[];
  suggestedAmount: number | null;
  suggestedAmountLabel: string | null;
  confidence: {
    score: number;
    label: "Baixa" | "Média" | "Alta";
  };
  metrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySurplus: number;
    liquidity: number;
    creditDebt: number;
    reserveTarget: number;
    reserveGap: number;
    reserveMonths: number;
    overdueAmount: number;
    monthsObserved: number;
  };
};

const monthKey = (date: string) => date.slice(0, 7);
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function calculateConfidence(
  accounts: ReadinessAccount[],
  transactions: ReadinessTransaction[],
  monthsObserved: number,
  referenceDate: string,
) {
  let score = 0;
  if (accounts.length > 0) score += 30;
  if (transactions.length >= 15) score += 30;
  else if (transactions.length >= 5) score += 15;
  if (monthsObserved >= 3) score += 25;
  else if (monthsObserved >= 2) score += 15;

  const latest = transactions
    .map((transaction) => Date.parse(`${transaction.date.slice(0, 10)}T00:00:00Z`))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const reference = Date.parse(`${referenceDate.slice(0, 10)}T00:00:00Z`);
  if (latest !== undefined && Math.abs(reference - latest) <= 14 * 86_400_000) score += 15;

  return {
    score,
    label: score >= 90 ? ("Alta" as const) : score >= 50 ? ("Média" as const) : ("Baixa" as const),
  };
}

export function analyzeFinancialReadiness(input: FinancialReadinessInput): FinancialReadiness {
  const referenceDate = input.referenceDate ?? new Date().toISOString().slice(0, 10);
  const relevant = input.transactions.filter(
    (transaction) => transaction.kind === "income" || transaction.kind === "expense",
  );
  const grouped = new Map<string, { income: number; expenses: number }>();

  for (const transaction of relevant) {
    const key = monthKey(transaction.date);
    const current = grouped.get(key) ?? { income: 0, expenses: 0 };
    if (transaction.kind === "income") current.income += Math.abs(transaction.amount);
    if (transaction.kind === "expense") current.expenses += Math.abs(transaction.amount);
    grouped.set(key, current);
  }

  const observedMonths = [...grouped.keys()].sort().reverse().slice(0, 3);
  const divisor = Math.max(1, observedMonths.length);
  const monthlyIncome =
    observedMonths.reduce((sum, key) => sum + grouped.get(key)!.income, 0) / divisor;
  const monthlyExpenses =
    observedMonths.reduce((sum, key) => sum + grouped.get(key)!.expenses, 0) / divisor;
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const liquidity = input.accounts
    .filter((account) => account.type === "CHECKING" || account.type === "SAVINGS")
    .reduce((sum, account) => sum + Math.max(0, account.balance), 0);
  const creditDebt = input.accounts
    .filter((account) => account.type === "CREDIT_CARD")
    .reduce((sum, account) => sum + Math.max(0, -account.balance), 0);
  const reserveTarget = monthlyExpenses * 3;
  const reserveGap = Math.max(0, reserveTarget - liquidity);
  const reserveMonths = monthlyExpenses > 0 ? liquidity / monthlyExpenses : 0;
  const overdueAmount = input.bills
    .filter((bill) => bill.status === "OVERDUE")
    .reduce((sum, bill) => sum + Math.abs(bill.amount), 0);
  const confidence = calculateConfidence(
    input.accounts,
    relevant,
    observedMonths.length,
    referenceDate,
  );
  const common = {
    confidence,
    metrics: {
      monthlyIncome,
      monthlyExpenses,
      monthlySurplus,
      liquidity,
      creditDebt,
      reserveTarget,
      reserveGap,
      reserveMonths,
      overdueAmount,
      monthsObserved: observedMonths.length,
    },
  };

  if (overdueAmount > 0) {
    return {
      ...common,
      stage: "organize",
      title: "Regularize primeiro as contas atrasadas",
      description:
        "Resolver vencimentos pendentes evita novos encargos antes de separar dinheiro para investir.",
      ctaLabel: "Ver contas atrasadas",
      href: "/bills",
      reasons: [`Há ${money.format(overdueAmount)} em contas atrasadas.`],
      suggestedAmount: overdueAmount,
      suggestedAmountLabel: "Total a regularizar",
    };
  }

  if (input.accounts.length === 0 || relevant.length < 5 || observedMonths.length < 2) {
    return {
      ...common,
      stage: "organize",
      title: "Conecte seus dados para receber um plano confiável",
      description:
        "Com contas e pelo menos dois meses de movimentações, calculamos sua sobra sem exigir conhecimento de investimentos.",
      ctaLabel: "Conectar contas",
      href: "/wallet/connect",
      reasons: [
        input.accounts.length === 0
          ? "Nenhuma conta foi conectada ainda."
          : "Ainda há pouco histórico para estimar sua média mensal.",
      ],
      suggestedAmount: null,
      suggestedAmountLabel: null,
    };
  }

  if (monthlySurplus <= 0) {
    const expensesByCategory = new Map<string, number>();
    for (const transaction of relevant.filter((item) => item.kind === "expense")) {
      expensesByCategory.set(
        transaction.category,
        (expensesByCategory.get(transaction.category) ?? 0) + Math.abs(transaction.amount),
      );
    }
    const largestCategory = [...expensesByCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      ...common,
      stage: "economize",
      title: "Recupere uma sobra mensal antes de investir",
      description: largestCategory
        ? `Comece revisando ${largestCategory}, sua maior categoria de despesa no período analisado.`
        : "Revise as despesas recorrentes e defina um limite que caiba na sua renda.",
      ctaLabel: "Ajustar orçamento",
      href: "/budget",
      reasons: [
        `A média de gastos supera a renda em ${money.format(Math.abs(monthlySurplus))} por mês.`,
      ],
      suggestedAmount: Math.abs(monthlySurplus),
      suggestedAmountLabel: "Sobra mensal a recuperar",
    };
  }

  if (creditDebt > 0) {
    return {
      ...common,
      stage: "economize",
      title: "Reduza a dívida do cartão antes do próximo aporte",
      description:
        "Direcionar parte da sobra para a dívida costuma proteger melhor o orçamento do que iniciar um novo investimento.",
      ctaLabel: "Revisar contas e cartões",
      href: "/bills",
      reasons: [`O saldo devedor identificado é de ${money.format(creditDebt)}.`],
      suggestedAmount: Math.min(creditDebt, monthlySurplus),
      suggestedAmountLabel: "Parcela possível da sobra",
    };
  }

  if (reserveGap > 0) {
    const contribution = Math.min(reserveGap, monthlySurplus * 0.5);
    return {
      ...common,
      stage: "protect",
      title: "Fortaleça sua reserva de emergência",
      description:
        "A meta inicial usa três meses da sua média de despesas. Você pode ajustá-la conforme sua estabilidade de renda.",
      ctaLabel: "Criar meta de reserva",
      href: "/goals",
      reasons: [
        `A reserva cobre ${reserveMonths.toFixed(1).replace(".", ",")} mês(es) de despesas.`,
      ],
      suggestedAmount: contribution,
      suggestedAmountLabel: "Sugestão mensal inicial",
    };
  }

  if (input.goals.length === 0) {
    return {
      ...common,
      stage: "protect",
      title: "Defina o objetivo do dinheiro antes de investir",
      description:
        "Prazo e finalidade determinam quanta liquidez e oscilação fazem sentido para você.",
      ctaLabel: "Definir uma meta",
      href: "/goals",
      reasons: ["Sua reserva inicial está coberta, mas ainda não há uma meta cadastrada."],
      suggestedAmount: monthlySurplus * 0.5,
      suggestedAmountLabel: "Valor disponível para planejar",
    };
  }

  if (input.investmentTotal <= 0) {
    return {
      ...common,
      stage: "invest",
      title: "Prepare seu primeiro investimento",
      description:
        "Sua base financeira está pronta. Agora escolha prazo e liquidez antes de comparar alternativas.",
      ctaLabel: "Começar de forma guiada",
      href: "/investments",
      reasons: ["Há sobra mensal, reserva inicial e objetivo cadastrado."],
      suggestedAmount: monthlySurplus * 0.5,
      suggestedAmountLabel: "Primeiro aporte conservador",
    };
  }

  return {
    ...common,
    stage: "track",
    title: "Acompanhe seu plano e o próximo aporte",
    description:
      "Sua estrutura financeira está montada. Revise desvios e mantenha os aportes alinhados às metas.",
    ctaLabel: "Acompanhar investimentos",
    href: "/investments",
    reasons: ["Há sobra mensal, reserva, metas e investimentos cadastrados."],
    suggestedAmount: monthlySurplus * 0.5,
    suggestedAmountLabel: "Próximo aporte sugerido",
  };
}
