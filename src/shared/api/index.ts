/**
 * Contratos de API entre o frontend e as server functions.
 * Todos os inputs de server function são validados com estes schemas.
 */
import { z } from "zod";

import {
  assetClassSchema,
  billStatusSchema,
  openFinanceScopeSchema,
  transactionTypeSchema,
} from "@/shared/domain";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createTransactionRequest = z.object({
  description: z.string().min(1, "Informe uma descrição"),
  amount: z.number(),
  type: transactionTypeSchema,
  category: z.string().min(1),
  merchant: z.string().optional(),
  accountId: z.string().uuid().optional(),
  occurredAt: isoDate,
});
export type CreateTransactionRequest = z.infer<typeof createTransactionRequest>;

export const categorizeRequest = z.object({
  transactions: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        amount: z.number(),
        merchant: z.string().nullable().optional(),
      }),
    )
    .max(50),
});
export type CategorizeRequest = z.infer<typeof categorizeRequest>;

export const categorizeResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      confidence: z.number(),
      reasoning: z.string(),
    }),
  ),
});
export type CategorizeResponse = z.infer<typeof categorizeResponse>;

export const upsertBudgetRequest = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1),
  planned: z.number().nonnegative(),
  month: isoDate,
});
export type UpsertBudgetRequest = z.infer<typeof upsertBudgetRequest>;

export const upsertGoalRequest = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  targetAmount: z.number().nonnegative(),
  currentAmount: z.number().nonnegative(),
  deadline: isoDate.nullable(),
});
export type UpsertGoalRequest = z.infer<typeof upsertGoalRequest>;

export const upsertPayableRequest = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1),
  amount: z.number(),
  dueDate: isoDate,
  status: billStatusSchema.optional(),
  category: z.string().optional(),
  barcode: z.string().nullable().optional(),
});
export type UpsertPayableRequest = z.infer<typeof upsertPayableRequest>;

export const upsertPositionRequest = z.object({
  id: z.string().uuid().optional(),
  ticker: z.string().min(1),
  name: z.string().optional(),
  assetClass: assetClassSchema,
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
});
export type UpsertPositionRequest = z.infer<typeof upsertPositionRequest>;

export const syncRequest = z.object({
  consentId: z.string().uuid(),
});
export type SyncRequest = z.infer<typeof syncRequest>;

export const syncResponse = z.object({
  synced: z.number(),
  categorized: z.number(),
  errors: z.array(z.string()),
});
export type SyncResponse = z.infer<typeof syncResponse>;

export const connectInstitutionRequest = z.object({
  institutionId: z.string().uuid(),
  scopes: z.array(openFinanceScopeSchema).min(1),
});
export type ConnectInstitutionRequest = z.infer<typeof connectInstitutionRequest>;

export const parseBoletoRequest = z.object({
  digitableLine: z.string().min(20),
});
export type ParseBoletoRequest = z.infer<typeof parseBoletoRequest>;

export const parsedBoleto = z.object({
  valid: z.boolean(),
  amount: z.number(),
  dueDate: isoDate.nullable(),
  barcode: z.string(),
});
export type ParsedBoleto = z.infer<typeof parsedBoleto>;

/** Passo do plano produzido pelo orquestrador multi-agente. */
export type PlanStep = {
  agent: "TransactionAgent" | "BudgetAgent" | "InvestmentAgent" | "TaxAgent" | "MemoryAgent";
  task: string;
};

/** Chamada de ferramenta renderizada como card no chat. */
export type ToolCallCard =
  | { kind: "transactions"; rows: Array<{ description: string; amount: number; date: string }> }
  | { kind: "cashflow"; points: Array<{ month: string; income: number; expenses: number }> }
  | { kind: "pix"; amount: number; to: string; when: string; confirmationToken: string }
  | { kind: "text"; text: string };
