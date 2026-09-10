export type StatementRow = {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  externalId: string;
  valid: boolean;
  errors: string[];
};

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

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

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  const br = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function parseAmount(value: string): number {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function parseStatementCsv(content: string, accountId: string): StatementRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter =
    (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCsvLine(lines[0]!, delimiter).map(normalizeHeader);
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = indexOf("data", "date", "datamovimento", "datatransacao");
  const descriptionIndex = indexOf("descricao", "description", "historico", "memo");
  const amountIndex = indexOf("valor", "amount", "value", "quantia");

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const rawDate = values[dateIndex] ?? "";
    const date = parseDate(rawDate);
    const description = (values[descriptionIndex] ?? "").trim();
    const amount = parseAmount(values[amountIndex] ?? "");
    const errors: string[] = [];
    if (dateIndex < 0 || !date) errors.push("Data inválida");
    if (descriptionIndex < 0 || !description) errors.push("Descrição ausente");
    if (amountIndex < 0 || amount === 0) errors.push("Valor inválido");
    const externalId = `statement:${accountId}:${date ?? rawDate}:${amount.toFixed(2)}:${description.toLowerCase()}`;
    return {
      rowNumber: index + 2,
      date: date ?? "",
      description,
      amount,
      externalId,
      valid: errors.length === 0,
      errors,
    };
  });
}
