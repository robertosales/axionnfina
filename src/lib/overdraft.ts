/**
 * Cheque especial (limite de conta corrente).
 *
 * Espelha a lógica dos bancos brasileiros:
 * - saldo próprio pode ficar negativo quando o limite é usado;
 * - limite contratado é fixo;
 * - saldo disponível = saldo próprio + limite contratado;
 * - uso do limite = |saldo| quando o saldo é negativo, limitado ao limite contratado.
 */
export type OverdraftStatus = {
  /** Limite contratado com o banco. */
  limit: number;
  /** Quanto do limite já está sendo consumido. */
  used: number;
  /** Quanto do limite ainda resta. */
  remaining: number;
  /** Saldo próprio somado ao limite contratado (poder de compra). */
  spendable: number;
  /** Percentual do limite consumido (0-100). */
  usedPercent: number;
  /** Verdadeiro quando o saldo próprio está negativo e o limite está em uso. */
  inUse: boolean;
  /** Verdadeiro quando existe limite contratado. */
  hasLimit: boolean;
};

export function overdraftStatus(balance: number, creditLimit: number | null | undefined): OverdraftStatus {
  const limit = Number.isFinite(creditLimit ?? NaN) ? Math.max(Number(creditLimit), 0) : 0;
  const used = balance < 0 ? Math.min(-balance, limit) : 0;
  const remaining = Math.max(limit - used, 0);
  return {
    limit,
    used,
    remaining,
    spendable: balance + limit,
    usedPercent: limit > 0 ? Math.min((used / limit) * 100, 100) : 0,
    inUse: used > 0,
    hasLimit: limit > 0,
  };
}

/** Verdadeiro quando a despesa ultrapassa saldo próprio + limite contratado. */
export function exceedsOverdraft(
  balance: number,
  creditLimit: number | null | undefined,
  expenseAmount: number,
): boolean {
  const { spendable } = overdraftStatus(balance, creditLimit);
  return expenseAmount > 0 && expenseAmount > spendable;
}
