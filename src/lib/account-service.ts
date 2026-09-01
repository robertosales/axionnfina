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

  const { data: id, error } = await supabase.rpc("upsert_account", {
    p_data: data as unknown as Json,
  });

  if (error) {
    throw new Error(`Nao foi possivel salvar a conta: ${error.message}`);
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
    console.error("[AccountService] getCreditCards failed:", error);
    return [];
  }

  return (data as CreditCard[]) ?? [];
}
