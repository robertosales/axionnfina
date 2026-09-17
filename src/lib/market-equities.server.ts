import {
  EQUITY_TICKERS,
  type EquityQuote,
  type MarketIndexSnapshot,
} from "./market-equities";

const CACHE_TTL_MS = 30 * 60 * 1000;
const BRAPI_BASE_URL = "https://brapi.dev/api";
const YAHOO_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; AxionnFinance/1.0)" };

export type EquitySnapshot = {
  fetchedAt: string;
  referenceDate: string;
  source: string;
  sourceUrl: string;
  quotes: EquityQuote[];
  indices: MarketIndexSnapshot[];
  health: { status: "available" | "unavailable"; detail: string };
};

let cache: EquitySnapshot | undefined;

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        regularMarketTime?: number;
        fiftyTwoWeekLow?: number;
        fiftyTwoWeekHigh?: number;
      };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

function isoDateFromSeconds(seconds: number | undefined): string {
  const date = seconds ? new Date(seconds * 1000) : new Date();
  return date.toISOString().slice(0, 10);
}

function percentChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from <= 0) return null;
  return Math.round(((to - from) / from) * 1000) / 10;
}

async function fetchYahooChart(symbol: string): Promise<YahooChart> {
  const response = await fetch(
    `${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}?range=1y&interval=1mo`,
    { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(12_000) },
  );
  if (!response.ok) throw new Error(`Yahoo respondeu HTTP ${response.status}.`);
  return (await response.json()) as YahooChart;
}

async function yahooQuote(ticker: string): Promise<EquityQuote> {
  const payload = await fetchYahooChart(`${ticker}.SA`);
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`Sem cotação para ${ticker}.`);
  }
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
    (value): value is number => typeof value === "number",
  );
  const firstClose = closes[0] ?? null;

  return {
    ticker,
    price: meta.regularMarketPrice,
    changePercent:
      typeof meta.regularMarketChangePercent === "number"
        ? Math.round(meta.regularMarketChangePercent * 100) / 100
        : null,
    change12mPercent: percentChange(firstClose, meta.regularMarketPrice),
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    referenceDate: isoDateFromSeconds(meta.regularMarketTime),
    source: "Yahoo Finance (B3)",
    sourceUrl: `https://finance.yahoo.com/quote/${ticker}.SA`,
  };
}

type BrapiResponse = {
  results?: Array<{
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
    historicalDataPrice?: Array<{ close?: number }>;
  }>;
};

/** Consulta a brapi em uma única chamada em lote. Só roda quando há BRAPI_TOKEN. */
async function brapiQuotes(token: string): Promise<EquityQuote[]> {
  const response = await fetch(
    `${BRAPI_BASE_URL}/quote/${EQUITY_TICKERS.join(",")}?range=1y&interval=1mo&token=${encodeURIComponent(token)}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`brapi respondeu HTTP ${response.status}.`);
  const payload = (await response.json()) as BrapiResponse;
  const results = payload.results ?? [];
  if (results.length === 0) throw new Error("brapi não retornou cotações.");

  const today = new Date().toISOString().slice(0, 10);
  return results.flatMap((item): EquityQuote[] => {
    if (!item.symbol || typeof item.regularMarketPrice !== "number") return [];
    const history = (item.historicalDataPrice ?? [])
      .map((point) => point.close)
      .filter((value): value is number => typeof value === "number");
    return [
      {
        ticker: item.symbol,
        price: item.regularMarketPrice,
        changePercent:
          typeof item.regularMarketChangePercent === "number"
            ? Math.round(item.regularMarketChangePercent * 100) / 100
            : null,
        change12mPercent: percentChange(history[0] ?? null, item.regularMarketPrice),
        fiftyTwoWeekLow: item.fiftyTwoWeekLow ?? null,
        fiftyTwoWeekHigh: item.fiftyTwoWeekHigh ?? null,
        referenceDate: today,
        source: "brapi.dev (B3)",
        sourceUrl: `https://brapi.dev/quote/${item.symbol}`,
      },
    ];
  });
}

async function fetchIndices(): Promise<MarketIndexSnapshot[]> {
  const [ibov, usd] = await Promise.allSettled([
    fetchYahooChart("^BVSP"),
    fetchYahooChart("USDBRL=X"),
  ]);

  const read = (
    settled: PromiseSettledResult<YahooChart>,
  ): { value: number | null; changePercent: number | null } => {
    if (settled.status !== "fulfilled") return { value: null, changePercent: null };
    const meta = settled.value.chart?.result?.[0]?.meta;
    return {
      value: typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null,
      changePercent:
        typeof meta?.regularMarketChangePercent === "number"
          ? Math.round(meta.regularMarketChangePercent * 100) / 100
          : null,
    };
  };

  const ibovData = read(ibov);
  const usdData = read(usd);
  return [
    { id: "ibovespa", label: "Ibovespa", unit: "pontos", ...ibovData },
    { id: "usdbrl", label: "Dólar comercial", unit: "R$", ...usdData },
  ];
}

/**
 * Cotações dos ETFs e fundos imobiliários curados, com cache de 30 minutos.
 * Usa brapi quando há token configurado e recua para o Yahoo automaticamente.
 * Nunca inventa número: o que falhar volta ausente e é sinalizado na tela.
 */
export async function getEquitySnapshot(options?: { force?: boolean }): Promise<EquitySnapshot> {
  const age = cache ? Date.now() - new Date(cache.fetchedAt).getTime() : Infinity;
  if (!options?.force && cache && age < CACHE_TTL_MS) return cache;

  const token = process.env["BRAPI_TOKEN"];
  let quotes: EquityQuote[] = [];
  let source = "brapi.dev (B3)";
  let sourceUrl = "https://brapi.dev";
  let detail = "";

  if (token) {
    try {
      quotes = await brapiQuotes(token);
      detail = `${quotes.length} ativos atualizados pela brapi.`;
    } catch (error) {
      detail = `brapi indisponível (${error instanceof Error ? error.message : "erro"}); usando Yahoo Finance.`;
    }
  }

  if (quotes.length === 0) {
    const settled = await Promise.allSettled(EQUITY_TICKERS.map((ticker) => yahooQuote(ticker)));
    quotes = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
    source = "Yahoo Finance (B3)";
    sourceUrl = "https://finance.yahoo.com";
    detail = `${detail}${detail ? " " : ""}${quotes.length} de ${EQUITY_TICKERS.length} ativos atualizados pelo Yahoo Finance.`;
  }

  const indices = await fetchIndices();

  if (quotes.length === 0) {
    const fallback: EquitySnapshot = {
      fetchedAt: new Date().toISOString(),
      referenceDate: new Date().toISOString().slice(0, 10),
      source,
      sourceUrl,
      quotes: [],
      indices,
      health: {
        status: "unavailable",
        detail: detail || "Nenhuma fonte de cotações respondeu.",
      },
    };
    return cache ? { ...cache, indices, health: fallback.health } : fallback;
  }

  cache = {
    fetchedAt: new Date().toISOString(),
    referenceDate: quotes[0]?.referenceDate ?? new Date().toISOString().slice(0, 10),
    source,
    sourceUrl,
    quotes,
    indices,
    health: { status: "available", detail },
  };
  return cache;
}
