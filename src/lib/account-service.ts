import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

/**
 * AccountService — CRUD de contas financeiras e reconciliação de saldos.
 *
 * Serviço determinístico — a LLM não deve calcular saldos diretamente.
 */

export type AccountType = "checking" | "savings" | "credit" | "investment";

export type FinancialAccount = {
  id: string;
  user_id: string;
  name: string;
  institution: string;
  institution_id: string | null;
  type: AccountType;
  balance: number;
  available_balance: number | null;
  credit_limit: number | null;
  currency: string;
  subtype: string | null;
  is_primary: boolean;
  is_archived: boolean;
  is_manual: boolean;
  open_finance: boolean;
  external_id: string | null;
  last_sync_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AccountConnection = {
  id: string;
  user_id: string;
  institution_id: string;
  consent_id: string | null;
  status: "active" | "inactive" | "error" | "pending";
  external_provider: string;
  error_message: string | null;
  last_sync_at: string | null;
  sync_interval_minutes: number;
  next_sync_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AccountBalance = {
  id: string;
  user_id: string;
  account_id: string;
  balance: number;
  available_balance: number | null;
  snapshot_date: string;
  source: string;
  created_at: string;
};

export type WalletSummary = {
  totals: {
    total_accounts: number;
    checking_count: number;
    savings_count: number;
    credit_count: number;
    investment_count: number;
    total_balance: number;
    liquid_balance: number;
    investment_balance: number;
    total_credit_limit: number;
    total_available_credit: number;
  };
  by_institution: Array<{
    name: string;
    logo_color: string | null;
    account_count: number;
    balance: number;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    institution_name: string | null;
    logo_color: string | null;
    type: AccountType;
    balance: number;
    available_balance: number | null;
    is_primary: boolean;
    is_manual: boolean;
    open_finance: boolean;
    card_last_four: string | null;
    card_brand: string | null;
    last_sync_at: string | null;
    currency: string;
    archived_at?: string | null;
    record_origin?: "manual" | "open_finance" | "import" | "system";
  }>;
};

export type CreditCard = {
  id: string;
  user_id: string;
  account_id: string;
  last_four: string;
  brand: string;
  holder_name: string;
  expiration_month: number | null;
  expiration_year: number | null;
  credit_limit: number;
  available_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  is_virtual: boolean;
  created_at: string;
  updated_at: string;
};

/* ------------------------------------------------------------------ */
/* RPCs                                                                */
/* ------------------------------------------------------------------ */

/**
 * Busca resumo consolidado da carteira.
 */
export async function getWalletSummary(): Promise<WalletSummary | null> {
  const { data, error } = await supabase.rpc("get_wallet_summary");
  if (error) {
    console.error("[AccountService] getWalletSummary failed:", error);
    return null;
  }
  return data as WalletSummary;
}

/** Contas arquivadas, mantidas fora do resumo patrimonial ativo. */
export async function getArchivedAccounts(): Promise<WalletSummary["accounts"]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id, name, institution, type, balance, available_balance, is_primary, is_manual, open_finance, last_sync_at, currency, archived_at, record_origin",
    )
    .not("archived_at", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Nao foi possivel listar contas arquivadas: ${error.message}`);
  return (data ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    institution_name: account.institution,
    logo_color: null,
    type: account.type,
    balance: Number(account.balance),
    available_balance:
      account.available_balance === null ? null : Number(account.available_balance),
    is_primary: account.is_primary,
    is_manual: account.is_manual,
    open_finance: account.open_finance,
    card_last_four: null,
    card_brand: null,
    last_sync_at: account.last_sync_at,
    currency: account.currency,
    archived_at: account.archived_at,
    record_origin: account.record_origin as NonNullable<
      WalletSummary["accounts"][number]["record_origin"]
    >,
  }));
}

/**
 * Cria ou atualiza uma conta financeira.
 */
export async function upsertAccount(data: {
  id?: string;
  name?: string;
  institution?: string;
  institution_id?: string;
  type?: AccountType;
  balance?: number;
  available_balance?: number;
  credit_limit?: number;
  currency?: string;
  subtype?: string;
  is_primary?: boolean;
  is_manual?: boolean;
  open_finance?: boolean;
  external_id?: string;
  metadata?: Record<string, unknown>;
  branch?: string;
  account_number?: string;
}): Promise<string | null> {
  if (data.id) {
    const { id, metadata, ...changes } = data;
    const { data: updated, error } = await supabase
      .from("accounts")
      .update({
        ...changes,
        ...(metadata === undefined ? {} : { metadata: metadata as Json }),
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Nao foi possivel atualizar a conta: ${error.message}`);
    }

    return updated.id;
  }

  if (!data.external_id) {
    const { data: session, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !session.user) throw new Error("Sessão expirada");
    const { data: created, error: createError } = await supabase
      .from("accounts")
      .insert({
        user_id: session.user.id,
        name: data.name ?? "Nova conta",
        institution: data.institution ?? "",
        type: data.type ?? "checking",
        balance: data.balance ?? 0,
        current_balance: data.balance ?? 0,
        branch: data.branch ?? null,
        account_number: data.account_number ?? null,
        currency: data.currency ?? "BRL",
        is_manual: data.is_manual ?? true,
        is_primary: data.is_primary ?? false,
        open_finance: data.open_finance ?? false,
        institution_id: data.institution_id ?? null,
        available_balance: data.available_balance ?? null,
        credit_limit: data.credit_limit ?? null,
        subtype: data.subtype ?? null,
        metadata: (data.metadata ?? {}) as Json,
      })
      .select("id")
      .single();
    if (createError) throw createError;
    return created.id;
  }

  const { data: id, error } = await supabase.rpc("upsert_account", {
    p_data: data as unknown as Json,
  });

  if (error) {
    throw new Error(`Nao foi possivel salvar a conta: ${error.message}`);
  }

  if (data.branch !== undefined || data.account_number !== undefined) {
    const { error: detailError } = await supabase
      .from("accounts")
      .update({
        ...(data.branch !== undefined ? { branch: data.branch } : {}),
        ...(data.account_number !== undefined ? { account_number: data.account_number } : {}),
      })
      .eq("id", id as string);
    if (detailError) throw detailError;
  }

  return id as string;
}

/**
 * Arquiva uma conta.
 */
export async function archiveAccount(accountId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("archive_account", {
    p_account_id: accountId,
  });

  if (error) {
    throw new Error(`Nao foi possivel arquivar a conta: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Define conta como padrão.
 */
export async function setPrimaryAccount(accountId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_primary_account", {
    p_account_id: accountId,
  });

  if (error) {
    throw new Error(`Nao foi possivel definir a conta principal: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Cria snapshot de saldo para uma conta.
 */
export async function createBalanceSnapshot(
  accountId: string,
  balance: number,
  availableBalance?: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_balance_snapshot", {
    p_account_id: accountId,
    p_balance: balance,
    ...(availableBalance === undefined ? {} : { p_available_balance: availableBalance }),
  });

  if (error) {
    console.error("[AccountService] createBalanceSnapshot failed:", error);
    return null;
  }

  return data as string;
}

/**
 * Busca histórico de saldos de uma conta.
 */
export async function getAccountBalances(accountId: string, limit = 30): Promise<AccountBalance[]> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
    .eq("account_id", accountId)
    .order("snapshot_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[AccountService] getAccountBalances failed:", error);
    return [];
  }

  return (data as AccountBalance[]) ?? [];
}

/**
 * Busca conexões Open Finance do usuário.
 */
export async function getAccountConnections(): Promise<AccountConnection[]> {
  const { data, error } = await supabase
    .from("account_connections")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AccountService] getAccountConnections failed:", error);
    return [];
  }

  return (data as AccountConnection[]) ?? [];
}

/**
 * Cria uma nova conexão Open Finance.
 */
export async function createConnection(data: {
  institution_id: string;
  consent_id?: string;
  status?: "active" | "inactive" | "error" | "pending";
  external_provider?: string;
  sync_interval_minutes?: number;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const { data: id, error } = await supabase.rpc("create_connection", {
    p_data: data as unknown as Json,
  });

  if (error) {
    console.error("[AccountService] createConnection failed:", error);
    return null;
  }

  return id as string;
}

/**
 * Busca cartões de crédito de uma conta.
 */
export async function getCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as CreditCard[]) ?? [];
}

export type InvoiceCardOption = {
  id: string;
  accountId: string;
  cardId: string | null;
  label: string;
};

/** Inclui contas de crédito antigas que ainda não têm um registro em credit_cards. */
export async function getInvoiceCardOptions(): Promise<InvoiceCardOption[]> {
  const [cards, accounts] = await Promise.all([
    getCreditCards(),
    supabase
      .from("accounts")
      .select("id, name, institution")
      .eq("type", "credit")
      .is("archived_at", null)
      .order("name"),
  ]);
  if (accounts.error) throw accounts.error;
  return (accounts.data ?? []).flatMap<InvoiceCardOption>((account) => {
    const linked = cards.filter((card) => card.account_id === account.id);
    const name = [account.name, account.institution].filter(Boolean).join(" · ");
    return linked.length
      ? linked.map((card) => ({
          id: card.id,
          accountId: account.id,
          cardId: card.id,
          label: `${name}${card.last_four ? ` · •••• ${card.last_four}` : ""}`,
        }))
      : [{ id: `account:${account.id}`, accountId: account.id, cardId: null, label: name }];
  });
}

/** Resolve o cadastro real antes de enviar o ID para o parser ou para a RPC da fatura. */
export async function resolveInvoiceCard(option: InvoiceCardOption): Promise<string> {
  if (option.cardId) return option.cardId;
  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, user_id")
    .eq("id", option.accountId)
    .eq("type", "credit")
    .is("archived_at", null)
    .single();
  if (error) throw error;
  const { data: existing, error: readError } = await supabase
    .from("credit_cards")
    .select("id")
    .eq("account_id", account.id)
    .order("created_at")
    .limit(1);
  if (readError) throw readError;
  if (existing?.[0]) return existing[0].id;
  // Identidade estável para o vínculo automático: tentativas simultâneas usam a mesma PK.
  // Dados de cartão desconhecidos permanecem vazios; não inventamos número ou bandeira.
  const { error: insertError } = await supabase.from("credit_cards").upsert(
    {
      id: account.id,
      user_id: account.user_id,
      account_id: account.id,
      last_four: "",
      brand: "other",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  const { data: card, error: verifyError } = await supabase
    .from("credit_cards")
    .select("id")
    .eq("id", account.id)
    .eq("account_id", account.id)
    .single();
  if (verifyError) throw verifyError;
  return card.id;
}
