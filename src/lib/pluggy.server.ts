/**
 * Pluggy server helpers — autenticação e listagem de conectores (instituições).
 * Nunca expõe client_secret nem a API key ao frontend.
 */

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

export type PluggyConnectorSummary = {
  id: number;
  name: string;
  institutionUrl: string | null;
  imageUrl: string | null;
  primaryColor: string | null;
  type: string;
  country: string;
  isOpenFinance: boolean;
  isSandbox: boolean;
  products: string[];
};

type PluggyConnectorRaw = {
  id: number;
  name: string;
  institutionUrl?: string | null;
  imageUrl?: string | null;
  primaryColor?: string | null;
  type?: string | null;
  country?: string | null;
  oauth?: boolean;
  isOpenFinance?: boolean;
  isSandbox?: boolean;
  products?: string[] | null;
};

let cachedApiKey: string | null = null;
let apiKeyExpiresAt = 0;

async function getApiKey(): Promise<string> {
  if (cachedApiKey && Date.now() < apiKeyExpiresAt) return cachedApiKey;

  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("MISSING_CREDENTIALS");
  }

  const res = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) throw new Error(`AUTH_FAILED_${res.status}`);

  const data = (await res.json()) as { apiKey: string; expiresIn?: number };
  cachedApiKey = data.apiKey;
  apiKeyExpiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000 - 60_000;
  return data.apiKey;
}

async function pluggyRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = await getApiKey();
  const response = await fetch(`${PLUGGY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`PLUGGY_${response.status}${detail ? `: ${detail}` : ""}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type PluggyItem = {
  id: string;
  clientUserId?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  connector: { id: number; name: string };
};

export type PluggyAccount = {
  id: string;
  itemId: string;
  name: string;
  marketingName?: string | null;
  type: "BANK" | "CREDIT" | string;
  subtype?: string | null;
  number?: string | null;
  balance: number;
  currencyCode?: string | null;
  bankData?: { overdraftContractedLimit?: number | null } | null;
  creditData?: {
    availableCreditLimit?: number | null;
    creditLimit?: number | null;
  } | null;
};

export type PluggyTransaction = {
  id: string;
  accountId: string;
  description?: string | null;
  amount: number;
  type?: string | null;
  category?: string | { description?: string | null } | null;
  merchant?: string | { name?: string | null } | null;
  mcc?: number | string | null;
  status?: string | null;
  date: string;
  createdAt?: string | null;
  balance?: number | null;
  currencyCode?: string | null;
};

export type PluggyInvestment = {
  id: string;
  accountId?: string | null;
  itemId?: string | null;
  type?: string | null;
  subtype?: string | null;
  name?: string | null;
  code?: string | null;
  isin?: string | null;
  quantity?: number | null;
  value?: number | null;
  amount?: number | null;
  balance?: number | null;
  amountOriginal?: number | null;
  amountProfit?: number | null;
  date?: string | null;
  dueDate?: string | null;
  issuer?: string | null;
  institution?: { name?: string | null } | null;
};

export type PluggyInvestmentTransaction = {
  id?: string | null;
  type: string;
  description?: string | null;
  quantity: number;
  value: number;
  amount: number;
  netAmount?: number | null;
  date: string;
  tradeDate?: string | null;
  expenses?: Record<string, number | null> | null;
};

export async function createPluggyConnectToken(userId: string): Promise<string> {
  const appUrl = process.env["APP_URL"];
  const webhookSecret = process.env["PLUGGY_WEBHOOK_SECRET"];
  const options: Record<string, string | boolean> = {
    clientUserId: userId,
    avoidDuplicates: true,
  };
  if (appUrl) {
    options["oauthRedirectUri"] = `${appUrl.replace(/\/$/, "")}/wallet/connect`;
    if (!webhookSecret) throw new Error("PLUGGY_WEBHOOK_SECRET não configurado.");
    await ensurePluggyWebhook(appUrl, webhookSecret);
  }

  const data = await pluggyRequest<{ accessToken: string }>("/connect_token", {
    method: "POST",
    body: JSON.stringify({ options }),
  });
  return data.accessToken;
}

type PluggyWebhook = { id: string; event: string; url: string };

async function ensurePluggyWebhook(appUrl: string, secret: string): Promise<void> {
  const url = `${appUrl.replace(/\/$/, "")}/api/webhooks/openfinance/pluggy`;
  if (!url.startsWith("https://")) return;

  const response = await pluggyRequest<PluggyWebhook[] | { results?: PluggyWebhook[] }>(
    "/webhooks",
  );
  const webhooks = Array.isArray(response) ? response : (response.results ?? []);
  const existing = webhooks.find((webhook) => webhook.url === url && webhook.event === "all");
  const body = JSON.stringify({
    event: "all",
    url,
    headers: { "x-axionn-webhook-secret": secret },
    enabled: true,
  });

  if (existing) {
    await pluggyRequest(`/webhooks/${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      body,
    });
  } else {
    await pluggyRequest("/webhooks", { method: "POST", body });
  }
}

export function getPluggyItem(itemId: string): Promise<PluggyItem> {
  return pluggyRequest<PluggyItem>(`/items/${encodeURIComponent(itemId)}`);
}

export async function getPluggyAccounts(itemId: string): Promise<PluggyAccount[]> {
  const data = await pluggyRequest<{ results?: PluggyAccount[] }>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`,
  );
  return data.results ?? [];
}

export async function getAllPluggyTransactions(accountId: string): Promise<PluggyTransaction[]> {
  const transactions: PluggyTransaction[] = [];
  let path = `/v2/transactions?accountId=${encodeURIComponent(accountId)}`;

  for (;;) {
    const page = await pluggyRequest<{ results?: PluggyTransaction[]; next?: string | null }>(path);
    transactions.push(...(page.results ?? []));
    if (!page.next) break;

    // Pluggy returns the complete next query string, e.g. "?accountId=...&after=...".
    path = page.next.startsWith("?")
      ? `/v2/transactions${page.next}`
      : `/v2/transactions?${page.next}`;
  }

  return transactions;
}

export async function getAllPluggyInvestments(itemId: string): Promise<PluggyInvestment[]> {
  const investments: PluggyInvestment[] = [];
  for (let page = 1; ; page += 1) {
    const result = await pluggyRequest<{ results?: PluggyInvestment[]; totalPages?: number }>(
      `/investments?itemId=${encodeURIComponent(itemId)}&pageSize=500&page=${page}`,
    );
    investments.push(...(result.results ?? []));
    if (page >= (result.totalPages ?? 1)) break;
  }
  return investments;
}

export async function getAllPluggyInvestmentTransactions(
  investmentId: string,
): Promise<PluggyInvestmentTransaction[]> {
  const transactions: PluggyInvestmentTransaction[] = [];
  for (let page = 1; ; page += 1) {
    const result = await pluggyRequest<{
      results?: PluggyInvestmentTransaction[];
      totalPages?: number;
    }>(`/investments/${encodeURIComponent(investmentId)}/transactions?pageSize=500&page=${page}`);
    transactions.push(...(result.results ?? []));
    if (page >= (result.totalPages ?? 1)) break;
  }
  return transactions;
}

export function deletePluggyItem(itemId: string): Promise<void> {
  return pluggyRequest<void>(`/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

export type ListConnectorsResult = {
  connectors: PluggyConnectorSummary[];
  total: number;
  error: string | null;
};

/** Lista os conectores (instituições) disponíveis na Pluggy. */
export async function listPluggyConnectors(
  search: string | undefined,
): Promise<ListConnectorsResult> {
  try {
    const params = new URLSearchParams({ countries: "BR", sandbox: "true" });
    if (search) params.set("name", search);

    const data = await pluggyRequest<{
      results?: PluggyConnectorRaw[];
      total?: number;
    }>(`/connectors?${params.toString()}`);

    const connectors = (data.results ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      institutionUrl: c.institutionUrl ?? null,
      imageUrl: c.imageUrl ?? null,
      primaryColor: c.primaryColor ? `#${c.primaryColor.replace("#", "")}` : null,
      type: c.type ?? "PERSONAL_BANK",
      country: c.country ?? "BR",
      isOpenFinance: Boolean(c.isOpenFinance ?? c.oauth),
      isSandbox: Boolean(c.isSandbox),
      products: c.products ?? [],
    }));

    return {
      connectors,
      total: data.total ?? connectors.length,
      error: null,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    return { connectors: [], total: 0, error: code };
  }
}
