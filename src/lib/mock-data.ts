/**
 * Dados mockados da Fase 1 (sem backend).
 * Estruturas espelham o domínio final: contas, transações, orçamento, metas.
 */

import type {
  Account,
  AgentInsight,
  BudgetItem,
  Goal,
  Transaction,
  UpcomingBill,
} from "@/shared/finance-types";

export const accounts: Account[] = [
  {
    id: "acc-1",
    institution: "Nubank",
    name: "Conta corrente",
    type: "CHECKING",
    balance: 18420.55,
    lastSyncedAt: "2026-08-20T11:40:00Z",
    openFinance: true,
  },
  {
    id: "acc-2",
    institution: "Itaú",
    name: "Poupança reserva",
    type: "SAVINGS",
    balance: 42750.0,
    lastSyncedAt: "2026-08-20T09:12:00Z",
    openFinance: true,
  },
  {
    id: "acc-3",
    institution: "Inter",
    name: "Cartão Black",
    type: "CREDIT_CARD",
    balance: -6231.88,
    lastSyncedAt: "2026-08-20T10:05:00Z",
    openFinance: true,
  },
  {
    id: "acc-4",
    institution: "XP Investimentos",
    name: "Carteira consolidada",
    type: "INVESTMENT",
    balance: 231980.4,
    lastSyncedAt: "2026-08-19T22:00:00Z",
    openFinance: false,
  },
];

export const cashflow = [
  { month: "Mar", receitas: 28400, despesas: 19850, saldo: 8550 },
  { month: "Abr", receitas: 27900, despesas: 21340, saldo: 6560 },
  { month: "Mai", receitas: 31200, despesas: 20110, saldo: 11090 },
  { month: "Jun", receitas: 29850, despesas: 24460, saldo: 5390 },
  { month: "Jul", receitas: 33100, despesas: 22980, saldo: 10120 },
  { month: "Ago", receitas: 30450, despesas: 18720, saldo: 11730 },
];

export const netWorthSeries = [
  { month: "Mar", value: 248300 },
  { month: "Abr", value: 254860 },
  { month: "Mai", value: 265950 },
  { month: "Jun", value: 271340 },
  { month: "Jul", value: 281460 },
  { month: "Ago", value: 293190 },
];

export const allocation = [
  { name: "Renda fixa", value: 98400, token: "var(--color-chart-1)" },
  { name: "Ações BR", value: 62150, token: "var(--color-chart-2)" },
  { name: "FIIs", value: 41230, token: "var(--color-chart-4)" },
  { name: "Exterior", value: 30200, token: "var(--color-chart-5)" },
];

export const budgetItems: BudgetItem[] = [
  { id: "b1", category: "Alimentação", planned: 2400, spent: 2088 },
  { id: "b2", category: "Transporte", planned: 900, spent: 962 },
  { id: "b3", category: "Moradia", planned: 4200, spent: 4200 },
  { id: "b4", category: "Lazer", planned: 1200, spent: 640, rollover: 180 },
  { id: "b5", category: "Saúde", planned: 800, spent: 310 },
];

export const goals: Goal[] = [
  {
    id: "g1",
    name: "Reserva de emergência",
    target: 60000,
    current: 42750,
    dueDate: "2027-03-01",
    monthlySuggestion: 2500,
  },
  {
    id: "g2",
    name: "Entrada apartamento",
    target: 180000,
    current: 61400,
    dueDate: "2029-01-01",
    monthlySuggestion: 3100,
  },
];

export const upcomingBills: UpcomingBill[] = [
  { id: "p1", name: "Cartão Inter", amount: 6231.88, dueDate: "2026-08-25", status: "SCHEDULED" },
  { id: "p2", name: "Aluguel", amount: 4200, dueDate: "2026-08-28", status: "PENDING" },
  { id: "p3", name: "Plano de saúde", amount: 812.4, dueDate: "2026-08-30", status: "PENDING" },
  { id: "p4", name: "IPVA parcela 5/6", amount: 486.2, dueDate: "2026-08-18", status: "OVERDUE" },
];

export const recentTransactions: Transaction[] = [
  {
    id: "t1",
    description: "iFood *Pedido 8821",
    merchant: "iFood",
    category: "Alimentação fora",
    kind: "expense",
    amount: -87.9,
    date: "2026-08-20",
    accountName: "Cartão Black",
    pending: true,
  },
  {
    id: "t2",
    description: "Salário Agosto",
    merchant: "Axionn Tech LTDA",
    category: "Salário",
    kind: "income",
    amount: 22400,
    date: "2026-08-19",
    accountName: "Conta corrente",
  },
  {
    id: "t3",
    description: "Aplicação CDB 112% CDI",
    merchant: "XP Investimentos",
    category: "Renda fixa",
    kind: "investment",
    amount: -5000,
    date: "2026-08-19",
    accountName: "Conta corrente",
  },
  {
    id: "t4",
    description: "Pix enviado — Poupança",
    merchant: "Itaú",
    category: "Transferência",
    kind: "transfer",
    amount: -1500,
    date: "2026-08-18",
    accountName: "Conta corrente",
  },
  {
    id: "t5",
    description: "Uber *Trip",
    merchant: "Uber",
    category: "Transporte",
    kind: "expense",
    amount: -34.7,
    date: "2026-08-18",
    accountName: "Cartão Black",
  },
  {
    id: "t6",
    description: "Supermercado Pão de Açúcar",
    merchant: "Pão de Açúcar",
    category: "Mercado",
    kind: "expense",
    amount: -412.33,
    date: "2026-08-17",
    accountName: "Cartão Black",
  },
];

export const agentInsights: AgentInsight[] = [
  {
    id: "i1",
    title: "Transporte estourou o orçamento",
    body: "Você gastou R$ 962 de R$ 900 planejados. 41% veio de corridas por app após 22h.",
    severity: "warning",
  },
  {
    id: "i2",
    title: "Taxa de poupança em alta",
    body: "38,5% da renda foi poupada em agosto — 6,2 p.p. acima da sua média semestral.",
    severity: "success",
  },
  {
    id: "i3",
    title: "DARF estimada de agosto",
    body: "Vendas de ações geraram lucro tributável de R$ 1.240. DARF estimada: R$ 186,00.",
    severity: "info",
  },
];

export const kpis = {
  netWorth: { value: 293190.4, change: 4.2 },
  liquidity: { value: 61170.55, change: 2.8 },
  savingsRate: { value: 38.5, change: 6.2 },
  nextBill: { value: 486.2, label: "IPVA parcela 5/6", dueDate: "2026-08-18" },
};
