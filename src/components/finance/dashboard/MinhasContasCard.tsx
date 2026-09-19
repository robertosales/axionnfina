import { Building2, CreditCard, Landmark, LineChart, PiggyBank } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AccountAvatar } from "@/components/finance/AccountAvatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Account } from "@/shared/finance-types";

const typeIcon = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  INVESTMENT: LineChart,
} as const;

type MinhasContasCardProps = {
  accounts: Account[];
  isLoading?: boolean;
  hidden?: boolean;
};

export function MinhasContasCard({
  accounts,
  isLoading,
  hidden,
}: MinhasContasCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Minhas contas</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma conta cadastrada.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Minhas contas</h3>
      <ul className="mt-4 space-y-2">
        {accounts.map((account) => {
          const Icon = typeIcon[account.type] ?? Building2;
          const isNegative = account.balance < 0;
          return (
            <li
              key={account.id}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
            >
              <AccountAvatar
                logoUrl={account.logoUrl ?? null}
                name={account.name}
                icon={Icon}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.institution}</p>
              </div>
              <span
                className={cn(
                  "numeric text-sm font-semibold",
                  isNegative ? "text-danger" : "text-foreground",
                )}
              >
                {hidden ? "•••" : formatBRL(account.balance)}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        to="/wallet/accounts"
        className="focus-ring mt-4 inline-block rounded text-sm text-primary underline"
      >
        VER MAIS
      </Link>
    </Card>
  );
}
