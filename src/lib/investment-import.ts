import type { AssetClass } from "@/shared/domain";

export type RawInvestmentPosition = {
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

export type NormalizedInvestmentPosition = {
  externalId: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  institution: string | null;
  maturityDate: string | null;
  privateProductType: "cdb" | "lci" | "lca" | null;
  fgcEligible: boolean | null;
  referenceDate: string | null;
};

const assetClass = (type = "", subtype = ""): AssetClass => {
  if (subtype === "REAL_ESTATE_FUND") return "fii";
  if (type === "EQUITY") return "stock";
  if (type === "ETF") return "etf";
  if (type === "FIXED_INCOME") return "fixed_income";
  if (type === "MUTUAL_FUND" || type === "SECURITY" || type === "COE") return "fund";
  return "cash";
};

const positive = (...values: Array<number | null | undefined>) =>
  values.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? 0;

export function normalizeInvestmentPosition(
  raw: RawInvestmentPosition,
): NormalizedInvestmentPosition {
  const type = raw.type?.toUpperCase() ?? "";
  const subtype = raw.subtype?.toUpperCase() ?? "";
  const marketValue = positive(raw.balance, raw.amount);
  const quantity = positive(raw.quantity, 1);
  const currentPrice = positive(raw.value, marketValue / quantity);
  const averagePrice = positive(
    raw.amountOriginal ? raw.amountOriginal / quantity : null,
    raw.amount ? raw.amount / quantity : null,
    currentPrice,
  );
  const product = ["CDB", "LCI", "LCA"].includes(subtype)
    ? (subtype.toLowerCase() as "cdb" | "lci" | "lca")
    : null;
  const fallbackCode = raw.name?.replace(/\s+/g, "-").slice(0, 40).toUpperCase() || "SEM-CODIGO";

  return {
    externalId: raw.id,
    ticker: raw.code?.trim() || raw.isin?.trim() || fallbackCode,
    name: raw.name?.trim() || raw.code?.trim() || "Investimento sem nome",
    assetClass: assetClass(type, subtype),
    quantity,
    averagePrice,
    currentPrice,
    marketValue,
    institution: raw.institution?.name?.trim() || raw.issuer?.trim() || null,
    maturityDate: raw.dueDate?.slice(0, 10) || null,
    privateProductType: product,
    fgcEligible: type === "FIXED_INCOME" ? Boolean(product) : null,
    referenceDate: raw.date?.slice(0, 10) || null,
  };
}

export type CsvInvestmentRow = NormalizedInvestmentPosition & {
  rowNumber: number;
  valid: boolean;
  errors: string[];
};

const parseNumber = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const splitCsvLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
};

export function parseInvestmentCsv(content: string): CsvInvestmentRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter =
    (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCsvLine(lines[0]!, delimiter).map((header) =>
    header
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""),
  );
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const at = (values: string[], ...names: string[]) => values[column(...names)] ?? "";

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const ticker = at(values, "ticker", "ativo", "codigo").toUpperCase();
    const name = at(values, "nome", "name") || ticker;
    const quantity = parseNumber(at(values, "quantidade", "quantity", "qtd"));
    const averagePrice = parseNumber(at(values, "precomedio", "averageprice", "preco"));
    const currentPrice =
      parseNumber(at(values, "precoatual", "currentprice", "valoratual")) || averagePrice;
    const rawClass = at(values, "classe", "assetclass", "tipo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const classMap: Record<string, AssetClass> = {
      acao: "stock",
      acoes: "stock",
      stock: "stock",
      fii: "fii",
      etf: "etf",
      rendafixa: "fixed_income",
      fixedincome: "fixed_income",
      fundo: "fund",
      fund: "fund",
      cripto: "crypto",
      crypto: "crypto",
      caixa: "cash",
      cash: "cash",
    };
    const errors: string[] = [];
    if (!ticker) errors.push("Ativo ausente");
    if (quantity <= 0) errors.push("Quantidade inválida");
    if (averagePrice < 0 || currentPrice < 0) errors.push("Preço inválido");
    if (!classMap[rawClass]) errors.push("Classe não reconhecida");
    const institution = at(values, "instituicao", "corretora", "banco") || null;
    const maturityDate = at(values, "vencimento", "maturitydate") || null;
    return {
      rowNumber: index + 2,
      valid: errors.length === 0,
      errors,
      externalId:
        `csv:${institution ?? "sem-instituicao"}:${ticker}:${maturityDate ?? "sem-vencimento"}`.toLowerCase(),
      ticker,
      name,
      assetClass: classMap[rawClass] ?? "cash",
      quantity,
      averagePrice,
      currentPrice,
      marketValue: quantity * currentPrice,
      institution,
      maturityDate,
      privateProductType: null,
      fgcEligible: null,
      referenceDate: null,
    };
  });
}
