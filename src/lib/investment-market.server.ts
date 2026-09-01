import {
  parseLatestTreasuryCsv,
  TREASURY_SOURCE_URL,
  type MarketIndicator,
  type TreasuryOpportunity,
} from "./investment-radar";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CSV_PREFIX_BYTES = 512 * 1024;
const BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

type MarketSnapshot = {
  fetchedAt: string;
  opportunities: TreasuryOpportunity[];
  indicators: MarketIndicator[];
  sourceHealth: Array<{
    source: string;
    status: "available" | "unavailable";
    detail: string;
  }>;
};

let marketCache: MarketSnapshot | undefined;

type BcbRow = { data: string; valor: string };

function brazilianDateToIso(value: string): string {
  const [day, month, year] = value.split("/");
  return day && month && year ? `${year}-${month}-${day}` : value;
}

async function fetchBcbSeries(code: number, count: number): Promise<BcbRow[]> {
  const response = await fetch(`${BCB_BASE_URL}.${code}/dados/ultimos/${count}?formato=json`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`BCB respondeu HTTP ${response.status}.`);
  return (await response.json()) as BcbRow[];
}

async function fetchIndicators(): Promise<MarketIndicator[]> {
  const [selicRows, ipcaRows] = await Promise.all([
    fetchBcbSeries(1178, 1),
    fetchBcbSeries(433, 12),
  ]);
  const selic = selicRows.at(-1);
  const latestIpca = ipcaRows.at(-1);
  if (!selic || !latestIpca) throw new Error("BCB não retornou as séries esperadas.");

  const ipca12m =
    (ipcaRows.reduce((factor, row) => factor * (1 + Number(row.valor.replace(",", ".")) / 100), 1) -
      1) *
    100;

  return [
    {
      id: "selic",
      label: "Selic efetiva anualizada",
      value: Number(selic.valor.replace(",", ".")),
      unit: "% a.a.",
      referenceDate: brazilianDateToIso(selic.data),
      source: "Banco Central do Brasil",
      sourceUrl: `${BCB_BASE_URL}.1178/dados/ultimos/1?formato=json`,
    },
    {
      id: "ipca12m",
      label: "IPCA acumulado em 12 meses",
      value: Math.round(ipca12m * 100) / 100,
      unit: "% a.a.",
      referenceDate: brazilianDateToIso(latestIpca.data),
      source: "Banco Central do Brasil",
      sourceUrl: `${BCB_BASE_URL}.433/dados/ultimos/12?formato=json`,
    },
  ];
}

async function readLatestTreasuryBlock(response: Response): Promise<string> {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder("windows-1252");
  const lines: string[] = [];
  let carry = "";
  let bytesRead = 0;
  let firstReferenceDate: string | undefined;

  try {
    while (bytesRead < MAX_CSV_PREFIX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      carry += decoder.decode(value, { stream: true });
      const chunks = carry.split(/\r?\n/);
      carry = chunks.pop() ?? "";

      for (const line of chunks) {
        if (!line.trim()) continue;
        if (lines.length === 0) {
          lines.push(line);
          continue;
        }
        const referenceDate = line.split(";")[2];
        if (!referenceDate) continue;
        firstReferenceDate ??= referenceDate;
        if (referenceDate !== firstReferenceDate) {
          await reader.cancel();
          return `${lines.join("\n")}\n`;
        }
        lines.push(line);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (carry.trim()) lines.push(carry);
  return lines.join("\n");
}

async function fetchTreasuryOpportunities(): Promise<TreasuryOpportunity[]> {
  const response = await fetch(TREASURY_SOURCE_URL, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Tesouro Transparente respondeu HTTP ${response.status}.`);
  const opportunities = parseLatestTreasuryCsv(await readLatestTreasuryBlock(response));
  if (opportunities.length === 0) throw new Error("Tesouro Transparente não retornou títulos.");
  return opportunities;
}

export async function getMarketSnapshot(options?: { force?: boolean }): Promise<{
  snapshot: MarketSnapshot;
  cacheStatus: "fresh" | "cached" | "stale";
}> {
  const cacheAge = marketCache ? Date.now() - new Date(marketCache.fetchedAt).getTime() : Infinity;
  if (!options?.force && marketCache && cacheAge < CACHE_TTL_MS) {
    return { snapshot: marketCache, cacheStatus: "cached" };
  }

  const [treasuryResult, indicatorResult] = await Promise.allSettled([
    fetchTreasuryOpportunities(),
    fetchIndicators(),
  ]);

  if (treasuryResult.status === "rejected") {
    if (marketCache) {
      return {
        snapshot: {
          ...marketCache,
          sourceHealth: marketCache.sourceHealth.map((source) =>
            source.source === "Tesouro Transparente"
              ? { ...source, status: "unavailable", detail: treasuryResult.reason.message }
              : source,
          ),
        },
        cacheStatus: "stale",
      };
    }
    throw treasuryResult.reason;
  }

  const indicators = indicatorResult.status === "fulfilled" ? indicatorResult.value : [];
  marketCache = {
    fetchedAt: new Date().toISOString(),
    opportunities: treasuryResult.value,
    indicators,
    sourceHealth: [
      {
        source: "Tesouro Transparente",
        status: "available",
        detail: `${treasuryResult.value.length} títulos oficiais no último dia disponível.`,
      },
      {
        source: "Banco Central do Brasil",
        status: indicatorResult.status === "fulfilled" ? "available" : "unavailable",
        detail:
          indicatorResult.status === "fulfilled"
            ? "Séries Selic 1178 e IPCA 433 atualizadas."
            : indicatorResult.reason.message,
      },
    ],
  };

  return { snapshot: marketCache, cacheStatus: "fresh" };
}
