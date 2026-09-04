import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  Account,
  AccountType,
  AgentInsight,
  BudgetItem,
  Goal,
  Transaction,
  UpcomingBill,
} from "@/lib/mock-data";
import type { AssetClass, BillStatus } from "@/shared/domain";
import { ASSET_CLASS_COLOR, ASSET_CLASS_LABEL } from "@/shared/domain";
import type {
  InvestmentObjective,
  InvestmentProfile,
  InvestmentRadarResponse,
  LiquidityPreference,
  RiskProfile,
} from "@/lib/investment-radar";
import type {
  InvestmentPlanAllocation,
  InvestmentPlanScenario,
  InvestmentPlanSimulation,
  SavedInvestmentPlan,
} from "@/lib/investment-plan";
import type {
  PrivateFixedIncomeOffer,
  PrivateProductType,
  PrivateRateType,
} from "@/lib/private-fixed-income";
import type {
  SavingsOpportunity,
  SavingsPlan,
  SavingsPlanStatus,
} from "@/lib/savings-opportunities";
import type { CsvInvestmentRow } from "@/lib/investment-import";
import type { StatementRow } from "@/lib/statement-import";
import type { FirstInvestmentAnswers, FirstInvestmentGuidance } from "@/lib/first-investment-guide";

type DbJson = Database["public"]["Tables"]["investment_plans"]["Row"]["allocations"];

/** Mapa entre o enum do banco e o tipo usado na UI. */
const dbToUiAccountType = {
  checking: "CHECKING",
  savings: "SAVINGS",
  credit: "CREDIT_CARD",
  investment: "INVESTMENT",
} as const;

const uiToDbAccountType = {
  CHECKING: "checking",
  SAVINGS: "savings",
  CREDIT_CARD: "credit",
  INVESTMENT: "investment",
} as const;

type DbAccountType = keyof typeof dbToUiAccountType;
type DbTransactionType = "income" | "expense" | "transfer";
type DbSeverity = "info" | "warning" | "critical";

const severityToUi = {
  info: "info",
  warning: "warning",
  critical: "danger",
} as const;

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user.id;
}

/** Contas do usuário logado, já no formato usado pelos componentes. */
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select(
          "id, name, institution, type, balance, open_finance, last_sync_at, branch, account_number",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        institution: row.institution,
        name: row.name,
        type: dbToUiAccountType[row.type as DbAccountType],
        balance: Number(row.balance),
        lastSyncedAt: row.last_sync_at ?? new Date().toISOString(),
        openFinance: row.open_finance,
        branch: row.branch ?? "",
        accountNumber: row.account_number ?? "",
      }));
    },
  });
}

export function useUpsertAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      institution: string;
      name: string;
      type: AccountType;
      balance: number;
      branch?: string;
      accountNumber?: string;
      openFinance?: boolean;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        institution: input.institution,
        name: input.name,
        type: uiToDbAccountType[input.type],
        balance: input.balance,
        open_finance: input.openFinance ?? false,
        last_sync_at: new Date().toISOString(),
        branch: input.branch?.trim() || null,
        account_number: input.accountNumber?.trim() || null,
      };
      const { error } = input.id
        ? await supabase.from("accounts").update(payload).eq("id", input.id)
        : await supabase.from("accounts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

/** Atualiza o carimbo da conta após uma sincronização Open Finance. */
export function useSyncAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await requireUserId();
      const { error } = await supabase
        .from("accounts")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useOpenFinanceInstitutions() {
  return useQuery({
    queryKey: ["openfinance-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, short_name, code, logo_color")
        .eq("openfinance_participant", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOpenFinanceConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { institutionId: string; scopes: string[] }) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("openfinance_consents")
        .insert({
          user_id: userId,
          institution_id: input.institutionId,
          scopes: input.scopes,
          status: "authorised",
          consent_id: `pending-provider-${crypto.randomUUID()}`,
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

/** Transações mais recentes do usuário logado. */
export function useTransactions(limit = 200, showArchived = false) {
  return useQuery({
    queryKey: ["transactions", limit, showArchived],
    queryFn: async (): Promise<Transaction[]> => {
      let request = supabase
        .from("transactions")
        .select(
          "id, account_id, description, merchant, category, type, amount, occurred_at, is_recurring, archived_at, record_origin, accounts(name)",
        )
        .order("occurred_at", { ascending: false })
        .limit(limit);
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        description: row.description,
        merchant: row.merchant ?? "",
        category: row.category,
        kind: row.type as DbTransactionType,
        amount: Number(row.amount),
        date: row.occurred_at,
        accountName: row.accounts?.name ?? "—",
        accountId: row.account_id,
        isRecurring: row.is_recurring,
        archivedAt: row.archived_at,
        recordOrigin: row.record_origin as NonNullable<Transaction["recordOrigin"]>,
      }));
    },
  });
}

/** Orçamento do mês corrente, com o gasto calculado a partir das transações. */
export function useBudgets(showArchived = false) {
  const transactions = useTransactions();

  const query = useQuery({
    queryKey: ["budgets", monthStart(), showArchived],
    queryFn: async () => {
      let request = supabase
        .from("budgets")
        .select("id, category, planned, month, archived_at, record_origin")
        .eq("month", monthStart())
        .order("category", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const month = monthStart().slice(0, 7);
  const items: BudgetItem[] = (query.data ?? []).map((row) => {
    const spent = (transactions.data ?? [])
      .filter((tx) => tx.category === row.category && tx.date.startsWith(month) && tx.amount < 0)
      .reduce((total, tx) => total + Math.abs(tx.amount), 0);
    return {
      id: row.id,
      category: row.category,
      planned: Number(row.planned),
      spent,
      archivedAt: row.archived_at,
      recordOrigin: row.record_origin as NonNullable<BudgetItem["recordOrigin"]>,
    };
  });

  return { ...query, items };
}

/** Metas financeiras com sugestão mensal derivada do prazo. */
export function useGoals(showArchived = false) {
  return useQuery({
    queryKey: ["goals", showArchived],
    queryFn: async (): Promise<Goal[]> => {
      let request = supabase
        .from("goals")
        .select("id, title, target_amount, current_amount, deadline, archived_at, record_origin")
        .order("created_at", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => {
        const target = Number(row.target_amount);
        const current = Number(row.current_amount);
        const deadline = row.deadline ?? "";
        const months = deadline
          ? Math.max(
              1,
              Math.round((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)),
            )
          : 12;
        return {
          id: row.id,
          name: row.title,
          target,
          current,
          dueDate: deadline,
          monthlySuggestion: Math.max(0, Math.round((target - current) / months)),
          archivedAt: row.archived_at,
          recordOrigin: row.record_origin as NonNullable<Goal["recordOrigin"]>,
        };
      });
    },
  });
}

/** Insights gerados pelo agente. */
export function useInsights(showArchived = false) {
  return useQuery({
    queryKey: ["insights", showArchived],
    queryFn: async (): Promise<AgentInsight[]> => {
      let request = supabase
        .from("agent_insights")
        .select("id, title, description, severity, archived_at, record_origin")
        .order("created_at", { ascending: false });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.description,
        severity: severityToUi[row.severity as DbSeverity],
        archivedAt: row.archived_at,
        recordOrigin: row.record_origin as NonNullable<AgentInsight["recordOrigin"]>,
      }));
    },
  });
}

/** Oportunidades de economia persistidas e seus resultados mensais confirmados. */
export function useSavingsPlans(includeDismissed = false) {
  return useQuery({
    queryKey: ["savings-plans", includeDismissed],
    queryFn: async (): Promise<SavingsPlan[]> => {
      let planRequest = supabase.from("savings_plans").select("*").order("updated_at", {
        ascending: false,
      });
      if (!includeDismissed) planRequest = planRequest.neq("status", "dismissed");

      const [plansResult, checkInsResult] = await Promise.all([
        planRequest,
        supabase.from("saving_plan_checkins").select("*").order("reference_month", {
          ascending: false,
        }),
      ]);
      if (plansResult.error) throw plansResult.error;
      if (checkInsResult.error) throw checkInsResult.error;

      return (plansResult.data ?? []).map((plan) => ({
        id: plan.id,
        key: plan.opportunity_key,
        kind: plan.kind as SavingsOpportunity["kind"],
        title: plan.title,
        description: plan.description,
        category: plan.category,
        merchant: plan.merchant,
        baselineMonthly: Number(plan.baseline_monthly),
        observedAmount: Number(plan.observed_amount),
        targetMonthly: Number(plan.target_monthly),
        expectedMonthlySaving: Number(plan.expected_monthly_saving),
        confidence: plan.confidence,
        evidence: Array.isArray(plan.evidence)
          ? plan.evidence.filter((item): item is string => typeof item === "string")
          : [],
        status: plan.status as SavingsPlanStatus,
        detectedOn: plan.detected_on,
        acceptedAt: plan.accepted_at,
        trackingStartedAt: plan.tracking_started_at,
        completedAt: plan.completed_at,
        dismissedAt: plan.dismissed_at,
        checkIns: (checkInsResult.data ?? [])
          .filter((checkIn) => checkIn.plan_id === plan.id)
          .map((checkIn) => ({
            id: checkIn.id,
            referenceMonth: checkIn.reference_month,
            baselineAmount: Number(checkIn.baseline_amount),
            actualAmount: Number(checkIn.actual_amount),
            realizedSaving: Number(checkIn.realized_saving),
            note: checkIn.note,
          })),
      }));
    },
  });
}

/** Salva apenas oportunidades ainda inexistentes; a chave torna a detecção idempotente. */
export function useSyncSavingsOpportunities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opportunities: SavingsOpportunity[]) => {
      if (opportunities.length === 0) return 0;
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("savings_plans")
        .upsert(
          opportunities.map((opportunity) => ({
            user_id: userId,
            opportunity_key: opportunity.key,
            kind: opportunity.kind,
            title: opportunity.title,
            description: opportunity.description,
            category: opportunity.category,
            merchant: opportunity.merchant,
            baseline_monthly: opportunity.baselineMonthly,
            observed_amount: opportunity.observedAmount,
            target_monthly: Math.max(
              0,
              opportunity.baselineMonthly - opportunity.expectedMonthlySaving,
            ),
            expected_monthly_saving: opportunity.expectedMonthlySaving,
            confidence: opportunity.confidence,
            evidence: opportunity.evidence as unknown as DbJson,
            status: "detected",
          })),
          { onConflict: "user_id,opportunity_key", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savings-plans"] }),
  });
}

export function useUpdateSavingsPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: SavingsPlanStatus;
      expectedMonthlySaving?: number;
      baselineMonthly?: number;
    }) => {
      const now = new Date().toISOString();
      const timestamp = {
        accepted: { accepted_at: now },
        tracking: { tracking_started_at: now },
        completed: { completed_at: now },
        dismissed: { dismissed_at: now },
        detected: {},
      }[input.status];
      const expected = input.expectedMonthlySaving;
      const { error } = await supabase
        .from("savings_plans")
        .update({
          status: input.status,
          ...timestamp,
          ...(expected !== undefined
            ? {
                expected_monthly_saving: expected,
                target_monthly: Math.max(0, (input.baselineMonthly ?? 0) - expected),
              }
            : {}),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savings-plans"] }),
  });
}

export function useSavingPlanCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      planId: string;
      referenceMonth: string;
      baselineAmount: number;
      actualAmount: number;
      note?: string;
    }) => {
      const userId = await requireUserId();
      const { error } = await supabase.from("saving_plan_checkins").upsert(
        {
          user_id: userId,
          plan_id: input.planId,
          reference_month: `${input.referenceMonth.slice(0, 7)}-01`,
          baseline_amount: input.baselineAmount,
          actual_amount: input.actualAmount,
          realized_saving: Math.max(0, input.baselineAmount - input.actualAmount),
          note: input.note?.trim() || null,
        },
        { onConflict: "plan_id,reference_month" },
      );
      if (error) throw error;

      const { error: planError } = await supabase
        .from("savings_plans")
        .update({ status: "tracking", tracking_started_at: new Date().toISOString() })
        .eq("id", input.planId);
      if (planError) throw planError;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["savings-plans"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Investimentos                                                       */
/* ------------------------------------------------------------------ */

export type Position = {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profit: number;
  privateProductType: PrivateProductType | null;
  institution: string | null;
  conglomerate: string | null;
  maturityDate: string | null;
  fgcEligible: boolean | null;
  archivedAt: string | null;
  recordOrigin: "manual" | "open_finance" | "import" | "system";
  source: "manual" | "open_finance" | "csv" | "pdf";
  lastSyncedAt: string | null;
};

export function useInvestments(showArchived = false) {
  const query = useQuery({
    queryKey: ["investments", showArchived],
    queryFn: async (): Promise<Position[]> => {
      let request = supabase
        .from("investment_positions")
        .select(
          "id, ticker, name, asset_class, quantity, average_price, current_price, private_product_type, institution, conglomerate, maturity_date, fgc_eligible, archived_at, record_origin, source, last_synced_at",
        )
        .order("ticker", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => {
        const quantity = Number(row.quantity);
        const averagePrice = Number(row.average_price);
        const currentPrice = Number(row.current_price);
        return {
          id: row.id,
          ticker: row.ticker,
          name: row.name,
          assetClass: row.asset_class as AssetClass,
          quantity,
          averagePrice,
          currentPrice,
          marketValue: quantity * currentPrice,
          profit: quantity * (currentPrice - averagePrice),
          privateProductType: row.private_product_type as PrivateProductType | null,
          institution: row.institution,
          conglomerate: row.conglomerate,
          maturityDate: row.maturity_date,
          fgcEligible: row.fgc_eligible,
          archivedAt: row.archived_at,
          recordOrigin: row.record_origin as Position["recordOrigin"],
          source: row.source as Position["source"],
          lastSyncedAt: row.last_synced_at,
        };
      });
    },
  });

  const positions = query.data ?? [];
  const total = positions.reduce((sum, p) => sum + p.marketValue, 0);

  const byClass = new Map<AssetClass, number>();
  for (const p of positions)
    byClass.set(p.assetClass, (byClass.get(p.assetClass) ?? 0) + p.marketValue);

  const allocation = [...byClass.entries()].map(([assetClass, value]) => ({
    name: ASSET_CLASS_LABEL[assetClass],
    value,
    token: ASSET_CLASS_COLOR[assetClass],
  }));

  return { ...query, positions, allocation, total };
}

/* ------------------------------------------------------------------ */
/* Contas a pagar / receber                                            */
/* ------------------------------------------------------------------ */

const statusToUi = {
  pending: "PENDING",
  paid: "SCHEDULED",
  overdue: "OVERDUE",
  canceled: "PENDING",
} as const satisfies Record<BillStatus, UpcomingBill["status"]>;

export type Payable = UpcomingBill & { category: string; scheduled: boolean; dbStatus: BillStatus };

export function usePayables(showArchived = false) {
  return useQuery({
    queryKey: ["payables", showArchived],
    queryFn: async (): Promise<Payable[]> => {
      let request = supabase
        .from("payables")
        .select(
          "id, description, amount, due_date, status, category, scheduled_for, archived_at, record_origin",
        )
        .order("due_date", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      return (data ?? []).map((row) => {
        const status = row.status as BillStatus;
        const overdue = status === "pending" && row.due_date < today;
        return {
          id: row.id,
          name: row.description,
          amount: Number(row.amount),
          dueDate: row.due_date,
          status: overdue ? "OVERDUE" : row.scheduled_for ? "SCHEDULED" : statusToUi[status],
          category: row.category,
          scheduled: Boolean(row.scheduled_for),
          dbStatus: status,
          archivedAt: row.archived_at,
          recordOrigin: row.record_origin as NonNullable<Payable["recordOrigin"]>,
        };
      });
    },
  });
}

export function useReceivables(showArchived = false) {
  return useQuery({
    queryKey: ["receivables", showArchived],
    queryFn: async () => {
      let request = supabase
        .from("receivables")
        .select("id, description, amount, due_date, status, payer, archived_at, record_origin")
        .order("due_date", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        description: row.description,
        amount: Number(row.amount),
        dueDate: row.due_date,
        status: row.status as BillStatus,
        payer: row.payer,
        archivedAt: row.archived_at,
        recordOrigin: row.record_origin,
      }));
    },
  });
}

/* ------------------------------------------------------------------ */
/* Séries derivadas                                                    */
/* ------------------------------------------------------------------ */

/** Fluxo de caixa dos últimos 6 meses, agregado a partir das transações reais. */
export function useCashflow(months = 6) {
  const transactions = useTransactions(1000);

  const buckets = new Map<
    string,
    { month: string; receitas: number; despesas: number; saldo: number }
  >();
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: MONTH_LABELS[d.getMonth()] ?? key,
      receitas: 0,
      despesas: 0,
      saldo: 0,
    });
  }

  for (const tx of transactions.data ?? []) {
    const key = tx.date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.amount >= 0) bucket.receitas += tx.amount;
    else bucket.despesas += Math.abs(tx.amount);
    bucket.saldo = bucket.receitas - bucket.despesas;
  }

  return { data: [...buckets.values()], isLoading: transactions.isLoading };
}

/** Histórico de patrimônio salvo em snapshots mensais. */
export function useNetWorthSeries() {
  return useQuery({
    queryKey: ["net-worth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_snapshots")
        .select("month, net_worth")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        month: MONTH_LABELS[Number(row.month.slice(5, 7)) - 1] ?? row.month,
        value: Number(row.net_worth),
      }));
    },
  });
}

export type TaxSummary = {
  year: number;
  month: number;
  swing_gross: number;
  swing_exempt: boolean;
  swing_tax: number;
  daytrade_tax: number;
  fii_tax: number;
  dividends: number;
  withheld: number;
  darf_due: number;
};

/** Resumo de IRPF do mês, calculado no banco. */
export function useTaxSummary(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return useQuery({
    queryKey: ["taxes", year, month],
    queryFn: async (): Promise<TaxSummary> => {
      const { data, error } = await supabase.rpc("calculate_irpf_monthly", {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      return data as unknown as TaxSummary;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      description: string;
      amount: number;
      type: DbTransactionType;
      category: string;
      merchant?: string;
      accountId?: string | null;
      occurredAt: string;
    }) => {
      const { error } = await supabase.rpc("create_manual_transaction", {
        p_data: {
          account_id: input.accountId,
          description: input.description,
          amount: input.amount,
          type: input.type,
          category: input.category,
          merchant: input.merchant ?? null,
          occurred_at: input.occurredAt,
        } as unknown as DbJson,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useImportStatementTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountId: string; rows: StatementRow[] }) => {
      const validRows = input.rows.filter((row) => row.valid);
      let imported = 0;
      for (const row of validRows) {
        const { error } = await supabase.rpc("upsert_transaction_idempotent", {
          p_idempotency_key: row.externalId,
          p_data: {
            account_id: input.accountId,
            description: row.description,
            amount: row.amount,
            type: row.amount >= 0 ? "income" : "expense",
            category: "Outros",
            occurred_at: row.date,
          } as unknown as DbJson,
        });
        if (error) throw error;
        imported += 1;
      }
      return { imported, ignored: input.rows.length - validRows.length };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
  });
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from("transactions").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      description: string;
      amount: number;
      type: DbTransactionType;
      category: string;
      merchant?: string;
      accountId?: string | null;
      occurredAt: string;
    }) => {
      const { error } = await supabase
        .from("transactions")
        .update({
          account_id: input.accountId ?? null,
          description: input.description,
          amount: input.amount,
          type: input.type,
          category: input.category,
          merchant: input.merchant ?? null,
          occurred_at: input.occurredAt,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; category: string; planned: number }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        category: input.category,
        planned: input.planned,
        month: monthStart(),
      };
      const { error } = input.id
        ? await supabase.from("budgets").update(payload).eq("id", input.id)
        : await supabase.from("budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      targetAmount: number;
      currentAmount: number;
      deadline: string | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        title: input.title,
        target_amount: input.targetAmount,
        current_amount: input.currentAmount,
        deadline: input.deadline,
      };
      const { error } = input.id
        ? await supabase.from("goals").update(payload).eq("id", input.id)
        : await supabase.from("goals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpsertPayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      description: string;
      amount: number;
      dueDate: string;
      category?: string;
      barcode?: string | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        category: input.category ?? "Outros",
        barcode: input.barcode ?? null,
      };
      const { error } = input.id
        ? await supabase.from("payables").update(payload).eq("id", input.id)
        : await supabase.from("payables").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payables"] }),
  });
}

export function useSettlePayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payables").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payables"] }),
  });
}

export type LifecycleEntity =
  | "account"
  | "transaction"
  | "budget"
  | "goal"
  | "investment"
  | "investment_plan"
  | "private_offer"
  | "payable"
  | "receivable"
  | "tax_event"
  | "insight";

const lifecycleQueryKey: Record<LifecycleEntity, string> = {
  account: "accounts",
  transaction: "transactions",
  budget: "budgets",
  goal: "goals",
  investment: "investments",
  investment_plan: "investment-plans",
  private_offer: "private-fixed-income-offers",
  payable: "payables",
  receivable: "receivables",
  tax_event: "tax-events",
  insight: "insights",
};

export type TaxEvent = {
  id: string;
  kind: string;
  assetClass: AssetClass;
  ticker: string;
  grossAmount: number;
  profit: number;
  withheld: number;
  occurredAt: string;
  archivedAt: string | null;
  recordOrigin: "manual" | "open_finance" | "import" | "system";
};

export function useTaxEvents(showArchived = false) {
  return useQuery({
    queryKey: ["tax-events", showArchived],
    queryFn: async (): Promise<TaxEvent[]> => {
      let request = supabase
        .from("tax_events")
        .select(
          "id, kind, asset_class, ticker, gross_amount, profit, withheld, occurred_at, archived_at, record_origin",
        )
        .order("occurred_at", { ascending: false });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((event) => ({
        id: event.id,
        kind: event.kind,
        assetClass: event.asset_class,
        ticker: event.ticker,
        grossAmount: Number(event.gross_amount),
        profit: Number(event.profit),
        withheld: Number(event.withheld),
        occurredAt: event.occurred_at,
        archivedAt: event.archived_at,
        recordOrigin: event.record_origin as TaxEvent["recordOrigin"],
      }));
    },
  });
}

async function setArchived(entity: LifecycleEntity, id: string, archived: boolean) {
  const archivedAt = archived ? new Date().toISOString() : null;
  const run = async () => {
    switch (entity) {
      case "account":
        return supabase
          .from("accounts")
          .update({ archived_at: archivedAt, is_archived: archived })
          .eq("id", id);
      case "transaction":
        return supabase.from("transactions").update({ archived_at: archivedAt }).eq("id", id);
      case "budget":
        return supabase.from("budgets").update({ archived_at: archivedAt }).eq("id", id);
      case "goal":
        return supabase.from("goals").update({ archived_at: archivedAt }).eq("id", id);
      case "investment":
        return supabase
          .from("investment_positions")
          .update({ archived_at: archivedAt })
          .eq("id", id);
      case "investment_plan":
        return supabase.from("investment_plans").update({ archived_at: archivedAt }).eq("id", id);
      case "private_offer":
        return supabase
          .from("private_fixed_income_offers")
          .update({ archived_at: archivedAt })
          .eq("id", id);
      case "payable":
        return supabase.from("payables").update({ archived_at: archivedAt }).eq("id", id);
      case "receivable":
        return supabase.from("receivables").update({ archived_at: archivedAt }).eq("id", id);
      case "tax_event":
        return supabase.from("tax_events").update({ archived_at: archivedAt }).eq("id", id);
      case "insight":
        return supabase.from("agent_insights").update({ archived_at: archivedAt }).eq("id", id);
    }
  };
  const { error } = await run();
  if (error) throw error;
}

async function deleteEntity(entity: LifecycleEntity, id: string) {
  const run = async () => {
    switch (entity) {
      case "account":
        return supabase.from("accounts").delete().eq("id", id);
      case "transaction":
        return supabase.from("transactions").delete().eq("id", id);
      case "budget":
        return supabase.from("budgets").delete().eq("id", id);
      case "goal":
        return supabase.from("goals").delete().eq("id", id);
      case "investment":
        return supabase.from("investment_positions").delete().eq("id", id);
      case "investment_plan":
        return supabase.from("investment_plans").delete().eq("id", id);
      case "private_offer":
        return supabase.from("private_fixed_income_offers").delete().eq("id", id);
      case "payable":
        return supabase.from("payables").delete().eq("id", id);
      case "receivable":
        return supabase.from("receivables").delete().eq("id", id);
      case "tax_event":
        return supabase.from("tax_events").delete().eq("id", id);
      case "insight":
        return supabase.from("agent_insights").delete().eq("id", id);
    }
  };
  const { error } = await run();
  if (error) throw error;
}

/** Mutations uniformes de arquivamento, restauração e exclusão auditável. */
export function useEntityLifecycle(entity: LifecycleEntity) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [lifecycleQueryKey[entity]] });
    if (entity === "account") void queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    if (entity === "transaction") void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    if (entity === "tax_event") void queryClient.invalidateQueries({ queryKey: ["taxes"] });
  };

  const archive = useMutation({
    mutationFn: (id: string) => setArchived(entity, id, true),
    onSuccess: invalidate,
  });
  const restore = useMutation({
    mutationFn: (id: string) => setArchived(entity, id, false),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEntity(entity, id),
    onSuccess: invalidate,
  });

  return { archive, restore, remove };
}

export function useUpsertInvestmentPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      ticker: string;
      name: string;
      assetClass: AssetClass;
      quantity: number;
      averagePrice: number;
      currentPrice: number;
      privateProductType?: PrivateProductType | null;
      institution?: string | null;
      conglomerate?: string | null;
      maturityDate?: string | null;
      fgcEligible?: boolean | null;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        ticker: input.ticker.toUpperCase(),
        name: input.name,
        asset_class: input.assetClass,
        quantity: input.quantity,
        average_price: input.averagePrice,
        current_price: input.currentPrice,
        private_product_type: input.privateProductType ?? null,
        institution: input.institution?.trim() || null,
        conglomerate: input.conglomerate?.trim() || null,
        maturity_date: input.maturityDate || null,
        fgc_eligible: input.fgcEligible ?? null,
        record_origin: "manual",
        source: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("investment_positions").update(payload).eq("id", input.id)
        : await supabase.from("investment_positions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useImportInvestmentPositions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fileName: string; rows: CsvInvestmentRow[] }) => {
      const userId = await requireUserId();
      const valid = input.rows.filter((row) => row.valid);
      const { data: batch, error: batchError } = await supabase
        .from("investment_import_batches")
        .insert({
          user_id: userId,
          file_name: input.fileName,
          file_type: "csv",
          status: "staged",
          rows_found: input.rows.length,
          rows_rejected: input.rows.length - valid.length,
          errors: input.rows
            .filter((row) => !row.valid)
            .map((row) => ({ row: row.rowNumber, errors: row.errors })) as unknown as DbJson,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      const { error } = await supabase.from("investment_positions").upsert(
        valid.map((row) => ({
          user_id: userId,
          ticker: row.ticker,
          name: row.name,
          asset_class: row.assetClass,
          quantity: row.quantity,
          average_price: row.averagePrice,
          current_price: row.currentPrice,
          institution: row.institution,
          maturity_date: row.maturityDate,
          private_product_type: row.privateProductType,
          fgc_eligible: row.fgcEligible,
          external_id: row.externalId,
          source: "csv",
          source_file_name: input.fileName,
          provider_balance: row.marketValue,
          raw_data: row as unknown as DbJson,
          record_origin: "import",
          archived_at: null,
        })),
        { onConflict: "user_id,source,external_id" },
      );
      if (error) {
        await supabase
          .from("investment_import_batches")
          .update({ status: "failed" })
          .eq("id", batch.id);
        throw error;
      }
      await supabase
        .from("investment_import_batches")
        .update({
          status: "completed",
          rows_imported: valid.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
      return { imported: valid.length, rejected: input.rows.length - valid.length };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useInvestmentRadar() {
  return useQuery({
    queryKey: ["investment-radar"],
    queryFn: async (): Promise<InvestmentRadarResponse> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const response = await fetch("/api/investment-radar", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as InvestmentRadarResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar o Radar.");
      return payload;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateInvestmentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: InvestmentProfile) => {
      const userId = await requireUserId();
      const payload: {
        risk_profile: RiskProfile;
        investment_horizon_months: number;
        liquidity_preference: LiquidityPreference;
        investment_objective: InvestmentObjective;
      } = {
        risk_profile: profile.riskProfile,
        investment_horizon_months: profile.horizonMonths,
        liquidity_preference: profile.liquidityPreference,
        investment_objective: profile.objective,
      };
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...payload });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investment-radar"] }),
  });
}

export type SavedInvestmentGuidance = {
  answers: FirstInvestmentAnswers;
  createdAt: string;
};

export function useLatestInvestmentGuidance() {
  return useQuery({
    queryKey: ["investment-guidance", "latest"],
    queryFn: async (): Promise<SavedInvestmentGuidance | null> => {
      const { data, error } = await supabase
        .from("investment_guidance_assessments")
        .select(
          "objective, horizon_months, liquidity_preference, fluctuation_tolerance, knowledge_level, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        answers: {
          objective: data.objective as InvestmentObjective,
          horizonMonths: data.horizon_months,
          liquidityPreference: data.liquidity_preference as LiquidityPreference,
          fluctuationTolerance:
            data.fluctuation_tolerance as FirstInvestmentAnswers["fluctuationTolerance"],
          knowledgeLevel: data.knowledge_level as FirstInvestmentAnswers["knowledgeLevel"],
        },
        createdAt: data.created_at,
      };
    },
    retry: false,
  });
}

export function useSaveInvestmentGuidance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      answers: FirstInvestmentAnswers;
      guidance: FirstInvestmentGuidance;
      financial: { stage: string; confidence: number; metrics: Record<string, number> };
    }) => {
      const userId = await requireUserId();
      const completedAt = new Date().toISOString();
      const { error: assessmentError } = await supabase
        .from("investment_guidance_assessments")
        .insert({
          user_id: userId,
          objective: input.answers.objective,
          horizon_months: input.answers.horizonMonths,
          liquidity_preference: input.answers.liquidityPreference,
          fluctuation_tolerance: input.answers.fluctuationTolerance,
          knowledge_level: input.answers.knowledgeLevel,
          derived_risk_profile: input.guidance.profile.riskProfile,
          readiness: input.guidance.readiness,
          financial_snapshot: input.financial as unknown as DbJson,
          educational_paths: input.guidance.paths as unknown as DbJson,
          created_at: completedAt,
        });
      if (assessmentError) throw assessmentError;

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        risk_profile: input.guidance.profile.riskProfile,
        investment_horizon_months: input.answers.horizonMonths,
        liquidity_preference: input.answers.liquidityPreference,
        investment_objective: input.answers.objective,
        investment_knowledge: input.answers.knowledgeLevel,
        fluctuation_tolerance: input.answers.fluctuationTolerance,
        investment_guidance_completed_at: completedAt,
      });
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investment-guidance"] });
      void queryClient.invalidateQueries({ queryKey: ["investment-radar"] });
    },
  });
}

export function useInvestmentPlans(showArchived = false) {
  return useQuery({
    queryKey: ["investment-plans", showArchived],
    queryFn: async (): Promise<SavedInvestmentPlan[]> => {
      let request = supabase
        .from("investment_plans")
        .select(
          "id, name, initial_amount, monthly_contribution, horizon_months, market_reference_date, profile_snapshot, allocations, scenarios, archived_at, created_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((plan) => ({
        id: plan.id,
        name: plan.name,
        input: {
          initialAmount: Number(plan.initial_amount),
          monthlyContribution: Number(plan.monthly_contribution),
          horizonMonths: plan.horizon_months,
        },
        allocations: plan.allocations as unknown as InvestmentPlanAllocation[],
        scenarios: plan.scenarios as unknown as InvestmentPlanScenario[],
        marketReferenceDate: plan.market_reference_date,
        profileSnapshot: plan.profile_snapshot as unknown as InvestmentProfile,
        archivedAt: plan.archived_at,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      }));
    },
  });
}

export function usePrivateFixedIncomeOffers(showArchived = false) {
  return useQuery({
    queryKey: ["private-fixed-income-offers", showArchived],
    queryFn: async (): Promise<PrivateFixedIncomeOffer[]> => {
      let request = supabase
        .from("private_fixed_income_offers")
        .select("*")
        .order("maturity_date", { ascending: true });
      request = showArchived
        ? request.not("archived_at", "is", null)
        : request.is("archived_at", null);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((offer) => ({
        id: offer.id,
        institution: offer.institution,
        conglomerate: offer.conglomerate,
        productType: offer.product_type as PrivateProductType,
        rateType: offer.rate_type as PrivateRateType,
        rateValue: Number(offer.rate_value),
        referenceRate: offer.reference_rate == null ? null : Number(offer.reference_rate),
        minimumInvestment: Number(offer.minimum_investment),
        maturityDate: offer.maturity_date,
        dailyLiquidity: offer.daily_liquidity,
        fgcEligible: offer.fgc_eligible,
        sourceUrl: offer.source_url,
        sourceCheckedAt: offer.source_checked_at,
        notes: offer.notes,
        archivedAt: offer.archived_at,
        recordOrigin: offer.record_origin as PrivateFixedIncomeOffer["recordOrigin"],
      }));
    },
  });
}

export function useUpsertPrivateFixedIncomeOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<PrivateFixedIncomeOffer, "id" | "archivedAt" | "recordOrigin"> & {
        id?: string;
      },
    ) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        institution: input.institution.trim(),
        conglomerate: input.conglomerate.trim(),
        product_type: input.productType,
        rate_type: input.rateType,
        rate_value: input.rateValue,
        reference_rate: input.rateType === "fixed" ? null : input.referenceRate,
        minimum_investment: input.minimumInvestment,
        maturity_date: input.maturityDate,
        daily_liquidity: input.dailyLiquidity,
        fgc_eligible: input.fgcEligible,
        source_url: input.sourceUrl?.trim() || null,
        source_checked_at: input.sourceCheckedAt,
        notes: input.notes?.trim() || null,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("private_fixed_income_offers").update(payload).eq("id", input.id)
        : await supabase.from("private_fixed_income_offers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["private-fixed-income-offers"] }),
  });
}

export type InvestmentAlertPreferences = {
  enabled: boolean;
  inAppEnabled: boolean;
  minimumScore: number;
  scoreChangeThreshold: number;
  driftThreshold: number;
  privateComparisonAmount: number;
  privateOfferMaxAgeDays: number;
  maturityAlertDays: number;
  lastEvaluatedAt: string | null;
};

export const DEFAULT_INVESTMENT_ALERT_PREFERENCES: InvestmentAlertPreferences = {
  enabled: true,
  inAppEnabled: true,
  minimumScore: 70,
  scoreChangeThreshold: 5,
  driftThreshold: 10,
  privateComparisonAmount: 10_000,
  privateOfferMaxAgeDays: 7,
  maturityAlertDays: 30,
  lastEvaluatedAt: null,
};

export function useInvestmentAlertPreferences() {
  return useQuery({
    queryKey: ["investment-alert-preferences"],
    queryFn: async (): Promise<InvestmentAlertPreferences> => {
      const { data, error } = await supabase
        .from("investment_alert_preferences")
        .select(
          "enabled, in_app_enabled, minimum_score, score_change_threshold, drift_threshold, private_comparison_amount, private_offer_max_age_days, maturity_alert_days, last_evaluated_at",
        )
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_INVESTMENT_ALERT_PREFERENCES;
      return {
        enabled: data.enabled,
        inAppEnabled: data.in_app_enabled,
        minimumScore: data.minimum_score,
        scoreChangeThreshold: data.score_change_threshold,
        driftThreshold: Number(data.drift_threshold),
        privateComparisonAmount: Number(data.private_comparison_amount),
        privateOfferMaxAgeDays: data.private_offer_max_age_days,
        maturityAlertDays: data.maturity_alert_days,
        lastEvaluatedAt: data.last_evaluated_at,
      };
    },
  });
}

export function useUpdateInvestmentAlertPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: Omit<InvestmentAlertPreferences, "lastEvaluatedAt">) => {
      const userId = await requireUserId();
      const { error } = await supabase.from("investment_alert_preferences").upsert({
        user_id: userId,
        enabled: preferences.enabled,
        in_app_enabled: preferences.inAppEnabled,
        minimum_score: preferences.minimumScore,
        score_change_threshold: preferences.scoreChangeThreshold,
        drift_threshold: preferences.driftThreshold,
        private_comparison_amount: preferences.privateComparisonAmount,
        private_offer_max_age_days: preferences.privateOfferMaxAgeDays,
        maturity_alert_days: preferences.maturityAlertDays,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["investment-alert-preferences"] }),
  });
}

export function useRunInvestmentMonitoring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await fetch("/api/investment-radar-daily", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: { insightsCreated: number; plansEvaluated: number };
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a análise.");
      return payload.result;
    },
    onSuccess: () => {
      for (const queryKey of [
        "investment-radar",
        "investment-radar-runs",
        "investment-plan-progress",
        "investment-alert-preferences",
        "insights",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    },
  });
}

export function useInvestmentProgressHistory(planId?: string) {
  return useQuery({
    queryKey: ["investment-plan-progress", planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_plan_progress_snapshots")
        .select("snapshot_date, overall_drift, status, actual_total")
        .eq("plan_id", planId!)
        .order("snapshot_date", { ascending: true })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((snapshot) => ({
        date: snapshot.snapshot_date,
        drift: Number(snapshot.overall_drift),
        status: snapshot.status,
        actualTotal: Number(snapshot.actual_total),
      }));
    },
  });
}

export function useUpsertInvestmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      simulation: InvestmentPlanSimulation;
      marketReferenceDate: string;
      profileSnapshot: InvestmentProfile;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        name: input.name.trim(),
        initial_amount: input.simulation.input.initialAmount,
        monthly_contribution: input.simulation.input.monthlyContribution,
        horizon_months: input.simulation.input.horizonMonths,
        market_reference_date: input.marketReferenceDate,
        profile_snapshot: input.profileSnapshot as unknown as DbJson,
        allocations: input.simulation.allocations as unknown as DbJson,
        scenarios: input.simulation.scenarios as unknown as DbJson,
        assumptions: input.simulation.assumptions as unknown as DbJson,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("investment_plans").update(payload).eq("id", input.id)
        : await supabase.from("investment_plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["investment-plans"] }),
  });
}

export function useUpsertReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      description: string;
      amount: number;
      dueDate: string;
      payer: string;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        payer: input.payer,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("receivables").update(payload).eq("id", input.id)
        : await supabase.from("receivables").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["receivables"] }),
  });
}

export function useUpsertTaxEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      kind: string;
      assetClass: AssetClass;
      ticker: string;
      grossAmount: number;
      profit: number;
      withheld: number;
      occurredAt: string;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        kind: input.kind,
        asset_class: input.assetClass,
        ticker: input.ticker.toUpperCase(),
        gross_amount: input.grossAmount,
        profit: input.profit,
        withheld: input.withheld,
        occurred_at: input.occurredAt,
        record_origin: "manual",
      } as const;
      const { error } = input.id
        ? await supabase.from("tax_events").update(payload).eq("id", input.id)
        : await supabase.from("tax_events").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-events"] });
      void queryClient.invalidateQueries({ queryKey: ["taxes"] });
    },
  });
}

export type TransactionCategory = {
  id: string;
  label: string;
  kind: "income" | "expense" | "transfer" | string;
  isSystem: boolean;
  archivedAt: string | null;
};

export function useTransactionCategories() {
  return useQuery({
    queryKey: ["transaction-categories"],
    queryFn: async (): Promise<TransactionCategory[]> => {
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("id, label, name, kind, is_system, archived_at")
        .is("archived_at", null)
        .order("kind")
        .order("label");
      if (error) throw error;
      return (data ?? []).map((category) => ({
        id: category.id,
        label: category.name ?? category.label,
        kind: category.kind,
        isSystem: category.is_system,
        archivedAt: category.archived_at,
      }));
    },
  });
}

export function useCreateTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; kind: "income" | "expense" }) => {
      const userId = await requireUserId();
      const label = input.label.trim();
      if (label.length < 2) throw new Error("Informe um nome de categoria válido.");

      const { error } = await supabase.from("transaction_categories").insert({
        user_id: userId,
        code: `custom_${crypto.randomUUID()}`,
        label,
        name: label,
        kind: input.kind,
        is_system: false,
        color: "#64748b",
      });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
        throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transaction-categories"] }),
  });
}

export function useArchiveTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transaction_categories")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .eq("is_system", false);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transaction-categories"] }),
  });
}

export function useUpdateTransactionCategoryDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; label: string }) => {
      const label = input.label.trim();
      if (label.length < 2) throw new Error("Informe um nome de categoria válido.");
      const { error } = await supabase
        .from("transaction_categories")
        .update({ label, name: label })
        .eq("id", input.id)
        .eq("is_system", false);
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
        throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transaction-categories"] }),
  });
}

/** Alias: lista de instituições participantes. */
export const useInstitutions = useOpenFinanceInstitutions;
