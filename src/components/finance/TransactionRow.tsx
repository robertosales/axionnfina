import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { formatBRL, formatShortDate, initials } from "@/lib/format";
import { transactionStatusText } from "@/lib/transaction-view";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/shared/finance-types";

const kindTone: Record<Transaction["kind"], string> = {
  income: "text-income",
  expense: "text-expense",
  transfer: "text-transfer",
  investment: "text-investment",
};

const kindLabel: Record<Transaction["kind"], string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  investment: "Investimento",
};

type Props = {
  transaction: Transaction;
  /** Recategorização inline (atualização otimista feita pelo chamador). */
  onCategoryChange?: (category: string) => void;
  onDelete?: () => void;
  categories?: readonly string[];
};

/** Linha de transação expansível com detalhes brutos e ações inline. */
export function TransactionRow({
  transaction,
  onCategoryChange,
  onDelete,
  categories = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transaction.category);

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
          {initials(transaction.merchant)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{transaction.description}</p>
          <p className="truncate text-xs text-muted-foreground">
            {transaction.accountName} · {formatShortDate(transaction.date)}
          </p>
        </div>

        <Badge variant="outline" className="hidden rounded-full text-[10px] sm:inline-flex">
          {transaction.category}
        </Badge>

        {transaction.pending && (
          <span className="size-2 shrink-0 rounded-full bg-warning" title="Pendente" />
        )}

        <span
          className={cn(
            "numeric w-28 text-right text-sm font-semibold",
            kindTone[transaction.kind],
          )}
        >
          {formatBRL(transaction.amount)}
        </span>
      </button>

      {open && (
        <dl className="grid grid-cols-2 gap-3 bg-muted/30 px-14 py-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">{kindLabel[transaction.kind]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estabelecimento</dt>
            <dd className="font-medium">{transaction.merchant}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Categoria</dt>
            <dd className="font-medium">{transaction.category}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{transactionStatusText(transaction)}</dd>
          </div>

          {(onCategoryChange || onDelete) && (
            <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-4">
              {onCategoryChange &&
                (editing ? (
                  <>
                    <input
                      list="tx-categories"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="focus-ring h-8 rounded-md border border-border bg-background px-2 text-xs"
                      aria-label="Nova categoria"
                    />
                    <datalist id="tx-categories">
                      {categories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      className="focus-ring rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      onClick={() => {
                        onCategoryChange(draft.trim() || transaction.category);
                        setEditing(false);
                      }}
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="focus-ring rounded-md border border-border px-3 py-1.5 text-xs"
                      onClick={() => {
                        setDraft(transaction.category);
                        setEditing(false);
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="focus-ring rounded-md border border-border px-3 py-1.5 text-xs"
                    onClick={() => setEditing(true)}
                  >
                    Recategorizar
                  </button>
                ))}

              {onDelete && (
                <button
                  type="button"
                  className="focus-ring rounded-md border border-danger/50 px-3 py-1.5 text-xs text-danger"
                  onClick={onDelete}
                >
                  Excluir
                </button>
              )}
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
