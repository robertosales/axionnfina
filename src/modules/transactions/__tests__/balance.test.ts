import { describe, expect, it } from "vitest";

import { transactionBalanceDelta, transactionUpdateBalanceDelta } from "../balance";

describe("transaction balance delta", () => {
  it("adds settled income and subtracts settled expense", () => {
    expect(
      transactionBalanceDelta({ account_id: "account", amount: 125.5, status: "settled" }),
    ).toBe(125.5);
    expect(
      transactionBalanceDelta({ account_id: "account", amount: -42.25, status: "settled" }),
    ).toBe(-42.25);
  });

  it("does not affect balance for pending, synced or accountless transactions", () => {
    for (const status of ["pending", "failed", "cancelled", "reversed"] as const) {
      expect(transactionBalanceDelta({ account_id: "account", amount: 10, status })).toBe(0);
    }
    expect(
      transactionBalanceDelta({
        account_id: "account",
        amount: 10,
        status: "settled",
        record_origin: "open_finance",
      }),
    ).toBe(0);
    expect(transactionBalanceDelta({ account_id: null, amount: 10, status: "settled" })).toBe(0);
  });

  it("reverses the previous value before applying an update", () => {
    expect(
      transactionUpdateBalanceDelta(
        { account_id: "origin", amount: -100, status: "settled" },
        { account_id: "origin", amount: -140, status: "settled" },
      ),
    ).toBe(-40);
    expect(
      transactionUpdateBalanceDelta(
        { account_id: "origin", amount: -100, status: "settled" },
        { account_id: "destination", amount: 100, status: "settled" },
      ),
    ).toBe(200);
  });

  it("is stable when the same import is evaluated twice", () => {
    const imported = {
      account_id: "account",
      amount: -75,
      status: "settled" as const,
      record_origin: "open_finance" as const,
    };
    expect(transactionBalanceDelta(imported) + transactionBalanceDelta(imported)).toBe(0);
  });
});
