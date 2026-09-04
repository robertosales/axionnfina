export type ImportedDocumentKind = "statement" | "credit_invoice";

export type DocumentRow = {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  installment: string | null;
  externalId: string;
  valid: boolean;
  errors: string[];
};

const parseAmount = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

const parseDate = (value: string) => {
  const normalized = value.trim();
  const br = normalized.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
};

const localName = (node: Element) => node.localName || node.nodeName.split(":").pop() || "";

export function parseStatementXml(content: string, accountId: string): DocumentRow[] {
  if (typeof DOMParser === "undefined") throw new Error("XML deve ser processado em ambiente com parser DOM.");
  const document = new DOMParser().parseFromString(content, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("XML inválido ou incompatível.");
  const candidates = Array.from(document.querySelectorAll("*"));
  const rows: DocumentRow[] = [];
  let rowNumber = 1;
  for (const node of candidates) {
    const children = Array.from(node.children);
    const text = (names: string[]) =>
      children.find((child) => names.includes(localName(child).toLowerCase()))?.textContent?.trim() ?? "";
    const rawDate = text(["date", "data", "postedat", "datamovimento"]);
    const description = text(["description", "descricao", "historico", "memo"]);
    const rawAmount = text(["amount", "valor", "value"]);
    if (!rawDate && !description && !rawAmount) continue;
    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    const errors: string[] = [];
    if (!date) errors.push("Data inválida");
    if (!description) errors.push("Descrição ausente");
    if (amount === 0) errors.push("Valor inválido");
    rows.push({
      rowNumber: rowNumber++,
      date: date ?? "",
      description,
      amount,
      installment: null,
      externalId: `xml:${accountId}:${date ?? rawDate}:${amount.toFixed(2)}:${description.toLowerCase()}`,
      valid: errors.length === 0,
      errors,
    });
  }
  return rows;
}

export function validatePdfFile(file: { name: string; size: number; header?: string }): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Selecione um arquivo PDF.";
  if (file.size > 10 * 1024 * 1024) return "O PDF deve ter no máximo 10 MB.";
  if (file.header && !file.header.startsWith("%PDF-")) return "O arquivo não parece ser um PDF válido.";
  return null;
}

export function parseInvoiceCsv(content: string, cardId: string): DocumentRow[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]!).map((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  const at = (values: string[], ...names: string[]) => values[headers.findIndex((header) => names.includes(header))] ?? "";
  return lines.slice(1).map((line, index) => {
    const values = split(line);
    const rawDate = at(values, "data", "date", "datacompra");
    const date = parseDate(rawDate);
    const description = at(values, "descricao", "description", "estabelecimento", "merchant");
    const amount = parseAmount(at(values, "valor", "amount", "parcela"));
    const installment = at(values, "parcela", "installment", "parcelaatual") || null;
    const errors: string[] = [];
    if (!date) errors.push("Data inválida");
    if (!description) errors.push("Estabelecimento ausente");
    if (amount === 0) errors.push("Valor inválido");
    return { rowNumber: index + 2, date: date ?? "", description, amount: -Math.abs(amount), installment, externalId: `invoice:${cardId}:${date ?? rawDate}:${amount.toFixed(2)}:${description.toLowerCase()}:${installment ?? ""}`, valid: errors.length === 0, errors };
  });
}

function parseTextRows(content: string, ownerId: string, prefix: "statement" | "invoice") {
  const rows: DocumentRow[] = [];
  const datePattern = /^(\d{2})[\/-](\d{2})[\/-](\d{4})\b/;
  const amountPattern = /(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:[.,]\d{2})/g;

  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    const dateMatch = trimmed.match(datePattern);
    if (!dateMatch) return;
    const date = parseDate(dateMatch[0]);
    const amountMatches = trimmed.match(amountPattern) ?? [];
    const rawAmount = amountMatches.at(-1) ?? "";
    const amount = parseAmount(rawAmount);
    const description = trimmed
      .slice(dateMatch[0].length)
      .replace(rawAmount, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[-|]+|[-|]+$/g, "")
      .trim();
    const errors: string[] = [];
    if (!date) errors.push("Data inválida");
    if (description.length < 2) errors.push("Descrição ausente");
    if (amount === 0) errors.push("Valor inválido");
    const normalizedAmount = prefix === "invoice" ? -Math.abs(amount) : amount;
    rows.push({
      rowNumber: index + 1,
      date: date ?? "",
      description,
      amount: normalizedAmount,
      installment: null,
      externalId: `pdf:${prefix}:${ownerId}:${date ?? dateMatch[0]}:${amount.toFixed(2)}:${description.toLowerCase()}`,
      valid: errors.length === 0,
      errors,
    });
  });
  return rows;
}

export function parseStatementText(content: string, accountId: string) {
  return parseTextRows(content, accountId, "statement");
}

export function parseInvoiceText(content: string, cardId: string) {
  return parseTextRows(content, cardId, "invoice");
}
