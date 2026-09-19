import { CreditCard } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AccountAvatar } from "@/components/finance/AccountAvatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Account } from "@/shared/finance-types";

type CreditCardSectionProps = {
  accounts: Account[];
  isLoading?: boolean;
  hidden?: boolean;
};

export function CreditCardSection({
  accounts,
  isLoading,
  hidden,
}: CreditCardSectionProps) {
  const creditCards = accounts.filter((a) => a.type === "CREDIT_CARD");

  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (creditCards.length === 0) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Cartões de crédito</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum cartão de crédito cadastrado.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Cartões de crédito</h3>
      <ul className="mt-4 space-y-3">
        {creditCards.map((card) => {
          const isNegative = card.balance < 0;
          return (
            <li
              key={card.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <AccountAvatar
                logoUrl={card.logoUrl ?? null}
                name={card.name}
                icon={CreditCard}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{card.name}</p>
                <p className="text-xs text-muted-foreground">{card.institution}</p>
              </div>
              <span
                className={cn(
                  "numeric text-sm font-semibold",
                  isNegative ? "text-danger" : "text-foreground",
                )}
              >
                {hidden ? "•••" : formatBRL(card.balance)}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        to="/bills"
        className="focus-ring mt-4 inline-block rounded text-sm text-primary underline"
      >
        VER MAIS
      </Link>
    </Card>
  );
}
