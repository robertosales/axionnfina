import { describe, expect, it } from "vitest";
import { buildExecutiveInsights, calculateReportMetrics, dateRangeForPreset, normalizePaymentMethod, type ReportTransaction } from "./reports";

const tx = (partial: Partial<ReportTransaction>): ReportTransaction => ({
  id: "1", description: "Teste", merchant: "", category: "Outros", kind: "expense", amount: -100,
  date: "2026-09-10", accountName: "Conta", accountId: "a", pending: false, archivedAt: null,
  recordOrigin: "manual", method: null, subcategory: null, ...partial,
});

describe("reports", () => {
  it("calcula fluxo sem contar transferências ou pendências", () => {
    const metrics = calculateReportMetrics([
      tx({ kind: "income", amount: 1000 }), tx({ amount: -400, category: "Casa", method: "pix" }),
      tx({ kind: "transfer", amount: -200 }), tx({ amount: -100, pending: true }),
    ], { start: "2026-09-01", end: "2026-09-30", accountId: null });
    expect(metrics.income).toBe(1000);
    expect(metrics.expenses).toBe(400);
    expect(metrics.savingsRate).toBe(60);
    expect(metrics.categories[0]?.category).toBe("Casa");
  });

  it("respeita conta e sinaliza ausência de comparação", () => {
    const metrics = calculateReportMetrics([tx({ accountId: "b" })], { start: "2026-09-01", end: "2026-09-30", accountId: "a" });
    expect(metrics.expenses).toBe(0);
    expect(metrics.expenseChange).toBeNull();
  });

  it("normaliza meios e gera briefing factual", () => {
    expect(normalizePaymentMethod("credit_installment")).toBe("Crédito parcelado");
    const metrics = calculateReportMetrics([tx({ kind: "income", amount: 1000 }), tx({ amount: -700, category: "Casa" })], { start: "2026-09-01", end: "2026-09-30", accountId: null });
    expect(buildExecutiveInsights(metrics)).toHaveLength(3);
  });

  it("calcula atalhos de período", () => {
    expect(dateRangeForPreset("previous", new Date("2026-09-22T12:00:00"))).toEqual({ start: "2026-08-01", end: "2026-08-31" });
  });
});
