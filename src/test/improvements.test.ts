import { describe, expect, it } from "vitest";

import { checkBillAlerts, checkBudgetAlerts } from "@/lib/finance/budget";
import { calculateEarlyPayoff, calculateLoanInterest } from "@/lib/finance/loans";
import { aggregateTags } from "@/lib/finance/tags";
import { filterTransactions } from "@/lib/transaction-view";
import type { Transaction } from "@/shared/finance-types";

describe("checkBudgetAlerts", () => {
  it("ignora categorias abaixo de 80%", () => {
    expect(
      checkBudgetAlerts([{ id: "1", category: "Mercado", planned: 1000, spent: 500 }]),
    ).toEqual([]);
  });

  it("emite warning aos 80% e danger ao estourar", () => {
    const alerts = checkBudgetAlerts([
      { id: "1", category: "Mercado", planned: 1000, spent: 800 },
      { id: "2", category: "Lazer", planned: 500, spent: 600 },
    ]);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.level).toBe("warning");
    expect(alerts[1]?.level).toBe("danger");
  });

  it("ignora orçamento zerado", () => {
    expect(checkBudgetAlerts([{ id: "1", category: "X", planned: 0, spent: 100 }])).toEqual([]);
  });
});

describe("checkBillAlerts", () => {
  it("ignora contas pagas", () => {
    expect(
      checkBillAlerts([{ id: "1", name: "Luz", amount: 100, dueDate: "2020-01-01", dbStatus: "paid" }]),
    ).toEqual([]);
  });

  it("marca vencidas e próximas do vencimento", () => {
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const alerts = checkBillAlerts([
      { id: "1", name: "Luz", amount: 100, dueDate: past, dbStatus: "pending" },
      { id: "2", name: "Água", amount: 50, dueDate: soon, dbStatus: "pending" },
    ]);
    expect(alerts.map((a) => a.status)).toEqual(["overdue", "due_soon"]);
  });
});

describe("calculateLoanInterest", () => {
  it("divide sem juros quando taxa é zero", () => {
    expect(calculateLoanInterest(1200, 0, 12)).toBeCloseTo(100);
  });

  it("parcela com juros é maior que sem juros", () => {
    expect(calculateLoanInterest(1200, 12, 12)).toBeGreaterThan(100);
  });
});

describe("calculateEarlyPayoff", () => {
  it("aplica desconto quando há juros", () => {
    const { discountedTotal, savings } = calculateEarlyPayoff(10000, 12, 12);
    expect(discountedTotal).toBeGreaterThan(0);
    expect(savings).toBeGreaterThan(0);
  });
});

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  description: "Mercado mensal",
  merchant: "Pão de Açúcar",
  category: "Mercado",
  kind: "expense",
  amount: -250,
  date: "2026-09-10",
  accountName: "Conta",
  accountId: "a1",
  status: "settled",
  tags: ["casa", "mensal"],
  ...overrides,
});

describe("aggregateTags", () => {
  it("agrega contagem e soma por tag, ordenado por contagem", () => {
    const stats = aggregateTags([
      { tags: ["casa", "mensal"], amount: -100 },
      { tags: ["casa"], amount: -50 },
      { tags: [], amount: 10 },
    ]);
    expect(stats).toEqual([
      { tag: "casa", count: 2, total: -150 },
      { tag: "mensal", count: 1, total: -100 },
    ]);
  });

  it("retorna vazio sem tags", () => {
    expect(aggregateTags([{ tags: [], amount: 5 }])).toEqual([]);
    expect(aggregateTags([{ tags: undefined as unknown as string[], amount: 5 }])).toEqual([]);
  });
});

describe("filterTransactions por tag", () => {
  const rows = [tx(), tx({ id: "t2", description: "Cinema", tags: ["lazer"] })];

  it("filtra pela tag exata", () => {
    const result = filterTransactions(rows, {
      search: "",
      kind: "all",
      account: "all",
      category: "all",
      tag: "lazer",
      status: "all",
      from: "",
      to: "",
    });
    expect(result.map((r) => r.id)).toEqual(["t2"]);
  });

  it("encontra tag pela busca textual", () => {
    const result = filterTransactions(rows, {
      search: "mensal",
      kind: "all",
      account: "all",
      category: "all",
      from: "",
      to: "",
    });
    expect(result.map((r) => r.id)).toEqual(["t1"]);
  });
});
