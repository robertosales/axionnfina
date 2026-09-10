/** Utilitários de formatação (pt-BR). */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formata valor em Reais. `compact` usa notação abreviada (R$ 12,4 mil). */
export function formatBRL(value: number, compact = false): string {
  return compact ? brlCompact.format(value) : brl.format(value);
}

/** Formata variação percentual com sinal explícito. */
export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits).replace(".", ",")}%`;
}

/** Data curta: 12 ago. */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    parseCalendarDate(iso),
  );
}

/** Data completa: 12 de agosto de 2026. */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(parseCalendarDate(iso));
}

/** Dias restantes até uma data (pode ser negativo). */
export function daysUntil(iso: string, from: Date = new Date()): number {
  const day = 86_400_000;
  const [year, month, date] = iso.slice(0, 10).split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined) return Number.NaN;
  const target = Date.UTC(year, month - 1, date);
  const base = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / day);
}

function parseCalendarDate(iso: string): Date {
  const calendarDate = iso.length === 10 ? `${iso}T12:00:00` : iso;
  return new Date(calendarDate);
}

/** Iniciais para avatar fallback. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(parseCalendarDate(iso));
}
