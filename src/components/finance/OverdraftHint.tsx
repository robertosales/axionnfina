import { formatBRL } from "@/lib/format";
import { overdraftStatus } from "@/lib/overdraft";
import { cn } from "@/lib/utils";

type OverdraftHintProps = {
  balance: number;
  creditLimit: number | null | undefined;
  /** Mostra a barra de consumo do limite. */
  showBar?: boolean;
  className?: string;
};

/**
 * Linha informativa de cheque especial, no mesmo formato de um extrato bancário:
 * limite disponível quando o saldo é positivo, limite em uso quando é negativo.
 */
export function OverdraftHint({
  balance,
  creditLimit,
  showBar = false,
  className,
}: OverdraftHintProps) {
  const status = overdraftStatus(balance, creditLimit);
  if (!status.hasLimit) return null;

  return (
    <div className={cn("mt-1 space-y-1", className)}>
      {status.inUse ? (
        <p className="text-xs font-medium text-warning">
          Usando {formatBRL(status.used)} do limite · restam {formatBRL(status.remaining)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Limite de {formatBRL(status.limit)} · disponível {formatBRL(status.spendable)}
        </p>
      )}
      {showBar && (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <div
            className={cn("h-full rounded-full", status.inUse ? "bg-warning" : "bg-success")}
            style={{ width: `${status.inUse ? status.usedPercent : 0}%` }}
          />
        </div>
      )}
      {status.inUse && (
        <p className="text-[11px] text-muted-foreground">
          O banco cobra juros diários sobre o cheque especial.
        </p>
      )}
    </div>
  );
}
