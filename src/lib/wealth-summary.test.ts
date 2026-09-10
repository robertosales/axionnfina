import type { Account } from "@/shared/finance-types";
import { describe, expect, it } from "vitest";
import { snapshotChange, syncFreshness, wealthSummary } from "./wealth-summary";

const account = (changes: Partial<Account> = {}): Account => ({
  id: "a",
  institution: "Banco",
  name: "Conta",
  balance: 100,
  type: "CHECKING",
  openFinance: false,
  lastSyncedAt: null,
  ...changes,
});
describe("patrimônio e origem dos dados", () => {
  it("não soma posições novamente quando já existem contas de investimento", () => {
    expect(
      wealthSummary(
        [
          account(),
          account({ type: "INVESTMENT", balance: 200 }),
          account({ type: "CREDIT_CARD", balance: -50 }),
        ],
        200,
      ).netWorth,
    ).toBe(250);
    expect(wealthSummary([account()], 200).netWorth).toBe(300);
  });
  it("não trata crédito disponível como dívida nem inventa sincronização", () => {
    expect(wealthSummary([account({ type: "CREDIT_CARD", balance: 50 })], 0).debts).toBe(0);
    expect(syncFreshness([account({ openFinance: true })])).toMatchObject({
      unknown: 1,
      oldest: null,
    });
  });
  it("exige meses comparáveis para variações", () => {
    const now = new Date(2026, 8, 10);
    const series = [
      { date: "2026-08-01", value: 100 },
      { date: "2026-09-01", value: 120 },
    ];
    expect(snapshotChange(series, 1, now)).toBe(20);
    expect(snapshotChange(series, 12, now)).toBeNull();
  });
});
