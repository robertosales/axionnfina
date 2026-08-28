import { describe, expect, it } from "vitest";

import {
  mapPluggyAccount,
  mapPluggyBalance,
  mapPluggyTransaction,
  mapPluggyInvestment,
} from "@/providers/openfinance/mapper";

describe("Open Finance Mapper", () => {
  describe("mapPluggyAccount", () => {
    it("mapeia conta CHECKING corretamente", () => {
      const result = mapPluggyAccount({
        id: "acc_123",
        connectorId: "conn_456",
        name: "Conta Itaú",
        type: "CHECKING",
        subtype: "DIGITAL_ACCOUNT",
        currencyCode: "BRL",
        status: "ACTIVE",
        balance: 5000.5,
        owned: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-08-28",
      });

      expect(result.id).toBe("acc_123");
      expect(result.name).toBe("Conta Itaú");
      expect(result.type).toBe("checking");
      expect(result.currency).toBe("BRL");
      expect(result.current_balance).toBe(5000.5);
      expect(result.is_manual).toBe(false);
      expect(result.external_id).toBe("acc_123");
    });

    it("mapeia CREDIT_CARD corretamente", () => {
      const result = mapPluggyAccount({
        id: "cc_789",
        connectorId: "conn_456",
        name: "Nubank",
        type: "CREDIT_CARD",
        subtype: null,
        currencyCode: "BRL",
        status: "ACTIVE",
        balance: -1200,
      });

      expect(result.type).toBe("credit_card");
      expect(result.current_balance).toBe(-1200);
    });

    it("mapeia tipo desconhecido como 'other'", () => {
      const result = mapPluggyAccount({
        id: "x_1",
        connectorId: "c_1",
        name: "Crypto Wallet",
        type: "CRYPTO",
        subtype: null,
        currencyCode: "USD",
        status: "ACTIVE",
        balance: 0,
      });

      expect(result.type).toBe("other");
    });
  });

  describe("mapPluggyBalance", () => {
    it("mapeia saldo corretamente", () => {
      const result = mapPluggyBalance({
        accountId: "acc_123",
        amount: 10000,
        currency: "BRL",
        date: "2026-08-28",
        type: "AVAILABLE",
      });

      expect(result.account_id).toBe("acc_123");
      expect(result.current).toBe(10000);
      expect(result.currency).toBe("BRL");
    });
  });

  describe("mapPluggyTransaction", () => {
    it("mapeia DEBIT como expense", () => {
      const result = mapPluggyTransaction({
        id: "tx_1",
        accountId: "acc_1",
        description: "iFood Pedido",
        amount: -87.9,
        type: "DEBIT",
        category: "FOOD",
        merchant: "iFood",
        mcc: 5812,
        status: "POSTED",
        date: "2026-08-20",
      });

      expect(result.type).toBe("expense");
      expect(result.amount).toBe(-87.9);
      expect(result.mcc).toBe("5812");
    });

    it("mapeia CREDIT como income", () => {
      const result = mapPluggyTransaction({
        id: "tx_2",
        accountId: "acc_1",
        description: "Salário",
        amount: 8000,
        type: "CREDIT",
        category: "SALARY",
        merchant: null,
        mcc: null,
        status: "POSTED",
        date: "2026-08-25",
      });

      expect(result.type).toBe("income");
      expect(result.amount).toBe(8000);
    });
  });

  describe("mapPluggyInvestment", () => {
    it("mapeia investimento corretamente", () => {
      const result = mapPluggyInvestment({
        id: "inv_1",
        accountId: "acc_inv",
        type: "STOCK",
        name: "Petrobras PN",
        ticker: "PETR4",
        quantity: 100,
        price: 38.5,
        balance: 3850,
        taxes: 0,
        netValue: 3850,
      });

      expect(result.ticker).toBe("PETR4");
      expect(result.quantity).toBe(100);
      expect(result.market_value).toBe(3850);
      expect(result.asset_class).toBe("STOCK");
    });
  });
});
