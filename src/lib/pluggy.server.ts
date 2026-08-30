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
    const apiKey = await getApiKey();
    const params = new URLSearchParams({ countries: "BR" });
    if (search) params.set("name", search);

    const res = await fetch(
      `${PLUGGY_BASE_URL}/connectors?${params.toString()}`,
      { headers: { "X-API-KEY": apiKey } },
    );

    if (!res.ok) {
      return { connectors: [], total: 0, error: `PROVIDER_ERROR_${res.status}` };
    }

    const data = (await res.json()) as {
      results?: PluggyConnectorRaw[];
      total?: number;
    };

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
