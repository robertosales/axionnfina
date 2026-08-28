import { describe, expect, it } from "vitest";

import {
  accountSchema,
  transactionSchema,
  budgetSchema,
  goalSchema,
  payableSchema,
  receivableSchema,
  agentMemorySchema,
  openFinanceConsentSchema,
} from "@/shared/domain";

import {
  createTransactionRequest,
  categorizeRequest,
  upsertBudgetRequest,
  upsertGoalRequest,
  upsertPayableRequest,
  syncRequest,
  connectInstitutionRequest,
} from "@/shared/api";

describe("Domain Schemas", () => {
  describe("accountSchema", () => {
    it("aceita conta válida", () => {
      const result = accountSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Conta corrente",
        institution: "Nubank",
        type: "checking",
        balance: 1000,
        openFinance: true,
        lastSyncAt: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejeita tipo inválido", () => {
      const result = accountSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Conta",
        institution: "Nubank",
        type: "invalid",
        balance: 1000,
        openFinance: false,
        lastSyncAt: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("transactionSchema", () => {
    it("aceita transação válida", () => {
      const result = transactionSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        accountId: null,
        description: "iFood Pedido",
        amount: -87.9,
        type: "expense",
        category: "Alimentação",
        merchant: "iFood",
        method: "credit_card",
        occurredAt: "2026-08-20",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("goalSchema", () => {
    it("rejeita valor alvo negativo", () => {
      const result = goalSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Reserva",
        targetAmount: -1000,
        currentAmount: 0,
        deadline: null,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("API Schemas", () => {
  describe("createTransactionRequest", () => {
    it("aceita request válido", () => {
      const result = createTransactionRequest.safeParse({
        description: "Uber Trip",
        amount: -34.7,
        type: "expense",
        category: "Transporte",
        occurredAt: "2026-08-20",
      });
      expect(result.success).toBe(true);
    });

    it("rejeita descrição vazia", () => {
      const result = createTransactionRequest.safeParse({
        description: "",
        amount: 100,
        type: "income",
        category: "Salário",
        occurredAt: "2026-08-20",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("categorizeRequest", () => {
    it("aceita request válido", () => {
      const result = categorizeRequest.safeParse({
        transactions: [
          { id: "1", description: "iFood", amount: -50, merchant: "iFood" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejeita mais de 50 transações", () => {
      const result = categorizeRequest.safeParse({
        transactions: Array.from({ length: 51 }, (_, i) => ({
          id: String(i),
          description: `Tx ${i}`,
          amount: -10,
        })),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("upsertGoalRequest", () => {
    it("aceita goal com prazo", () => {
      const result = upsertGoalRequest.safeParse({
        title: "Férias",
        targetAmount: 10000,
        currentAmount: 2000,
        deadline: "2027-01-01",
      });
      expect(result.success).toBe(true);
    });
  });
});
