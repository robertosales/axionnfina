export type FinancialHealthInput = {
  monthlyIncome: number;
  monthlyExpenses: number;
  liquidAssets: number;
  totalDebts: number;
  overdueBills: number;
  monthsObserved: number;
  transactionCount: number;
};

/**
 * Calcula um indicador educativo de saúde financeira (0-100).
 * Fluxo vale 30 pontos, reserva 30, dívidas 25 e compromissos em dia 15.
 * A confiança mede somente a cobertura dos dados e não aumenta a nota.
 */
export function calculateHealthScore(input: FinancialHealthInput) {
  const income = Math.max(0, input.monthlyIncome);
  const expenses = Math.max(0, input.monthlyExpenses);
  const savingsRate = income > 0 ? (income - expenses) / income : 0;
  const cashflow = Math.round(Math.max(0, Math.min(1, savingsRate / 0.2)) * 30);
  const reserveMonths = expenses > 0 ? Math.max(0, input.liquidAssets) / expenses : 0;
  const reserve = Math.round(Math.max(0, Math.min(1, reserveMonths / 6)) * 30);
  const annualIncome = income * 12;
  const debtRatio = annualIncome > 0 ? Math.max(0, input.totalDebts) / annualIncome : null;
  const debt = debtRatio === null ? 0 : Math.round(Math.max(0, Math.min(1, 1 - debtRatio)) * 25);
  const commitments = input.overdueBills === 0 ? 15 : Math.max(0, 15 - input.overdueBills * 5);
  const coverage =
    Math.min(1, input.monthsObserved / 6) * 0.6 + Math.min(1, input.transactionCount / 60) * 0.4;
  const confidence =
    coverage >= 0.8
      ? ("Alta" as const)
      : coverage >= 0.45
        ? ("Média" as const)
        : ("Baixa" as const);

  return {
    score: cashflow + reserve + debt + commitments,
    confidence,
    breakdown: { cashflow, reserve, debt, commitments },
  };
}
