/** Parse de entrada, sem arredondamento ou cálculo de domínio. Aceita decimal BR e decimal sem agrupamento. */
export function parseFinancialInput(input: string, decimals = 2): number {
  const text = input.trim().replace(/^([+-]?)R\$\s*/, "$1");
  if (!text) return Number.NaN;
  const pattern = text.includes(",")
    ? new RegExp(`^[+-]?(?:\\d+|\\d{1,3}(?:\\.\\d{3})+),\\d{1,${decimals}}$`)
    : new RegExp(`^[+-]?\\d+(?:\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(text)) return Number.NaN;
  const normalized = text.includes(",") ? text.replaceAll(".", "").replace(",", ".") : text;
  const value = Number(normalized);
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100
    ? value
    : Number.NaN;
}

export function localDateInput(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
