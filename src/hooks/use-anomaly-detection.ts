/**
 * useAnomalyDetection — Detecta anomalias em gastos comparando com a média histórica.
 * Alerta quando uma categoria excede 2 desvios padrão da média dos últimos 3 meses.
 */
import { useMemo } from "react";

import { useTransactions } from "@/lib/finance-data";

type Anomaly = {
  category: string;
  currentMonth: number;
  average: number;
  deviation: number;
  severity: "warning" | "danger";
  message: string;
};

export function useAnomalyDetection(months = 3) {
  const { data: transactions = [], isLoading } = useTransactions(1000);

  const anomalies = useMemo(() => {
    if (transactions.length === 0) return [];

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Agrupa gastos por categoria e mês
    const byCategoryMonth = new Map<string, Map<string, number>>();

    for (const tx of transactions) {
      if (tx.kind !== "expense") continue;
      const monthKey = tx.date.slice(0, 7);
      const category = tx.category;

      if (!byCategoryMonth.has(category)) {
        byCategoryMonth.set(category, new Map());
      }
      const monthMap = byCategoryMonth.get(category)!;
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + Math.abs(tx.amount));
    }

    const result: Anomaly[] = [];

    for (const [category, monthMap] of byCategoryMonth) {
      const currentAmount = monthMap.get(currentMonthKey) ?? 0;
      if (currentAmount === 0) continue;

      // Calcula média dos últimos N meses (excluindo o atual)
      const historicalAmounts: number[] = [];
      for (let i = 1; i <= months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const amount = monthMap.get(key) ?? 0;
        if (amount > 0) historicalAmounts.push(amount);
      }

      if (historicalAmounts.length < 2) continue;

      const avg = historicalAmounts.reduce((s, v) => s + v, 0) / historicalAmounts.length;
      const variance = historicalAmounts.reduce((s, v) => s + (v - avg) ** 2, 0) / historicalAmounts.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) continue;

      const deviation = (currentAmount - avg) / stdDev;

      if (deviation > 2) {
        const severity = deviation > 3 ? "danger" : "warning";
        const pctIncrease = Math.round(((currentAmount - avg) / avg) * 100);
        result.push({
          category,
          currentMonth: currentAmount,
          average: avg,
          deviation,
          severity,
          message: `${category} está ${pctIncrease}% acima da média (${formatBRL(avg)}/mês)`,
        });
      }
    }

    return result.sort((a, b) => b.deviation - a.deviation);
  }, [transactions, months]);

  return { anomalies, isLoading };
}

/** Calcula a "idade do dinheiro" (dias desde a última receita). */
export function useMoneyAge() {
  const { data: transactions = [], isLoading } = useTransactions(200);

  const daysSinceLastIncome = useMemo(() => {
    const incomes = transactions
      .filter((t) => t.kind === "income")
      .sort((a, b) => b.date.localeCompare(a.date));

    if (incomes.length === 0) return null;

    const lastIncome = new Date(incomes[0]!.date);
    const now = new Date();
    return Math.round((now.getTime() - lastIncome.getTime()) / 86_400_000);
  }, [transactions]);

  return { daysSinceLastIncome, isLoading };
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
