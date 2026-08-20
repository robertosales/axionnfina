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
export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits).replace(".", ",")}%`;
}

/** Data curta: 12 ago. */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(iso),
  );
}

/** Data completa: 12 de agosto de 2026. */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso));
}

/** Dias restantes até uma data (pode ser negativo). */
export function daysUntil(iso: string, from: Date = new Date()): number {
  const day = 86_400_000;
  const target = new Date(iso).setHours(0, 0, 0, 0);
  const base = new Date(from).setHours(0, 0, 0, 0);
  return Math.round((target - base) / day);
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
