import type { Transaction } from "@/lib/mock-data";

export type SavingsOpportunityKind =
  "subscription" | "recurring" | "category_increase" | "unusual_expense";

export type SavingsOpportunity = {
  key: string;
  kind: SavingsOpportunityKind;
  title: string;
  description: string;
  category: string;
  merchant: string | null;
  baselineMonthly: number;
  observedAmount: number;
  expectedMonthlySaving: number;
  confidence: number;
  evidence: string[];
};

export type SavingsPlanStatus = "detected" | "accepted" | "tracking" | "completed" | "dismissed";

export type SavingPlanCheckIn = {
  id: string;
  referenceMonth: string;
  baselineAmount: number;
  actualAmount: number;
  realizedSaving: number;
  note: string | null;
};

export type SavingsPlan = SavingsOpportunity & {
  id: string;
  status: SavingsPlanStatus;
  targetMonthly: number;
  detectedOn: string;
  acceptedAt: string | null;
  trackingStartedAt: string | null;
  completedAt: string | null;
  dismissedAt: string | null;
  checkIns: SavingPlanCheckIn[];
};

type DetectionInput = {
  transactions: Transaction[];
  referenceDate?: string;
};

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const shiftMonth = (reference: Date, offset: number) =>
  monthKey(new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, 1)));

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

const rounded = (value: number) => Math.round(Math.max(0, value) * 100) / 100;

const isSubscription = (transaction: Transaction) => {
  const text =
    `${transaction.category} ${transaction.merchant} ${transaction.description}`.toLowerCase();
  return /assinatura|streaming|software|saas|subscription|mensalidade/.test(text);
};

export function detectSavingsOpportunities({
  transactions,
  referenceDate = new Date().toISOString().slice(0, 10),
}: DetectionInput): SavingsOpportunity[] {
  const reference = new Date(`${referenceDate.slice(0, 10)}T00:00:00Z`);
  const analyzedMonth = shiftMonth(reference, -1);
  const historicalMonths = [-2, -3, -4].map((offset) => shiftMonth(reference, offset));
  const expenses = transactions.filter(
    (transaction) => transaction.kind === "expense" && !transaction.archivedAt,
  );
  const opportunities: SavingsOpportunity[] = [];

  const byMerchant = new Map<string, Transaction[]>();
  for (const transaction of expenses) {
    const name = (transaction.merchant || transaction.description).trim();
    if (!name) continue;
    const key = normalizeKey(name);
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), transaction]);
  }

  for (const [merchantKey, merchantTransactions] of byMerchant) {
    const recent = merchantTransactions.filter((item) =>
      [analyzedMonth, ...historicalMonths].includes(item.date.slice(0, 7)),
    );
    const distinctMonths = new Set(recent.map((item) => item.date.slice(0, 7)));
    const countsByMonth = new Map<string, number>();
    for (const item of recent) {
      const key = item.date.slice(0, 7);
      countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + 1);
    }
    const explicitlyRecurring = recent.some((item) => item.isRecurring);
    const appearsMonthly =
      distinctMonths.size >= 3 && [...countsByMonth.values()].every((count) => count <= 2);
    if (!explicitlyRecurring && !appearsMonthly) continue;

    const amounts = recent.map((item) => Math.abs(item.amount));
    const baseline = average(amounts);
    const variation = baseline > 0 ? (Math.max(...amounts) - Math.min(...amounts)) / baseline : 1;
    if (!explicitlyRecurring && variation > 0.3) continue;

    const sample = recent[0]!;
    const subscription = recent.some(isSubscription);
    const merchant = sample.merchant || sample.description;
    opportunities.push({
      key: `${subscription ? "subscription" : "recurring"}:${merchantKey}`,
      kind: subscription ? "subscription" : "recurring",
      title: subscription
        ? `Revise a assinatura ${merchant}`
        : `Negocie o gasto recorrente com ${merchant}`,
      description: subscription
        ? "Confirme se você ainda usa o serviço antes de manter, trocar de plano ou cancelar."
        : "Este pagamento aparece com frequência e pode oferecer espaço para negociação ou ajuste.",
      category: sample.category,
      merchant,
      baselineMonthly: rounded(baseline),
      observedAmount: rounded(baseline),
      expectedMonthlySaving: rounded(subscription ? baseline : baseline * 0.1),
      confidence: explicitlyRecurring ? 95 : Math.min(90, 55 + distinctMonths.size * 10),
      evidence: [
        `${distinctMonths.size} meses com cobranças semelhantes`,
        `Valor médio de R$ ${baseline.toFixed(2).replace(".", ",")}`,
      ],
    });
  }

  const byCategoryMonth = new Map<string, Map<string, number>>();
  for (const transaction of expenses) {
    const categoryMonths = byCategoryMonth.get(transaction.category) ?? new Map<string, number>();
    const key = transaction.date.slice(0, 7);
    categoryMonths.set(key, (categoryMonths.get(key) ?? 0) + Math.abs(transaction.amount));
    byCategoryMonth.set(transaction.category, categoryMonths);
  }

  for (const [category, months] of byCategoryMonth) {
    const current = months.get(analyzedMonth) ?? 0;
    const history = historicalMonths
      .map((month) => months.get(month) ?? 0)
      .filter((value) => value > 0);
    if (current <= 0 || history.length < 2) continue;
    const baseline = average(history);
    const excess = current - baseline;
    const increase = baseline > 0 ? excess / baseline : 0;
    if (increase < 0.2 || excess < 50) continue;

    opportunities.push({
      key: `category-increase:${normalizeKey(category)}:${analyzedMonth}`,
      kind: "category_increase",
      title: `Defina um limite para ${category}`,
      description:
        "O último mês ficou acima do seu próprio padrão. Revise os gastos antes de transformar a diferença em meta.",
      category,
      merchant: null,
      baselineMonthly: rounded(baseline),
      observedAmount: rounded(current),
      expectedMonthlySaving: rounded(excess),
      confidence: Math.min(92, 60 + history.length * 10),
      evidence: [
        `${Math.round(increase * 100)}% acima da média recente`,
        `${history.length} meses usados como comparação`,
      ],
    });
  }

  const analyzedTransactions = expenses.filter((item) => item.date.slice(0, 7) === analyzedMonth);
  for (const transaction of analyzedTransactions) {
    const historicalAmounts = expenses
      .filter(
        (item) =>
          item.category === transaction.category &&
          historicalMonths.includes(item.date.slice(0, 7)),
      )
      .map((item) => Math.abs(item.amount));
    if (historicalAmounts.length < 4) continue;
    const typical = median(historicalAmounts);
    const amount = Math.abs(transaction.amount);
    const excess = amount - typical;
    if (typical <= 0 || amount < typical * 2 || excess < 100) continue;

    opportunities.push({
      key: `unusual:${transaction.id}`,
      kind: "unusual_expense",
      title: `Confira este gasto fora do padrão`,
      description: `${transaction.merchant || transaction.description} ficou bem acima do valor típico de ${transaction.category}.`,
      category: transaction.category,
      merchant: transaction.merchant || null,
      baselineMonthly: rounded(typical),
      observedAmount: rounded(amount),
      expectedMonthlySaving: rounded(excess),
      confidence: Math.min(90, 55 + historicalAmounts.length * 5),
      evidence: [
        `Gasto de R$ ${amount.toFixed(2).replace(".", ",")}`,
        `Valor típico de R$ ${typical.toFixed(2).replace(".", ",")}`,
      ],
    });
  }

  return opportunities
    .sort((a, b) => b.expectedMonthlySaving - a.expectedMonthlySaving)
    .filter(
      (opportunity, index, all) => all.findIndex((item) => item.key === opportunity.key) === index,
    )
    .slice(0, 8);
}
