import { ArrowDownRight, ArrowUpRight, CreditCard, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type SummaryCardsProps = {
  liquidity: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  creditCardTotal: number;
  isLoading?: boolean;
  hidden?: boolean;
};

type SummaryCardProps = {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  hidden: boolean | undefined;
};

function SummaryCard({ label, value, icon: Icon, color, hidden }: SummaryCardProps) {
  const isNegative = value < 0;

  return (
    <Card className="flex items-center gap-4 bg-card p-4 shadow-none sm:p-5">
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          color,
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "numeric mt-1 break-words text-xl font-semibold sm:text-2xl",
            isNegative ? "text-danger" : "text-foreground",
          )}
        >
          {hidden ? "••••" : formatBRL(value)}
        </p>
      </div>
    </Card>
  );
}

export function SummaryCards({
  liquidity,
  monthlyIncome,
  monthlyExpenses,
  creditCardTotal,
  isLoading,
  hidden,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card p-4 shadow-none sm:p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-7 w-32" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <SummaryCard
        label="Saldo atual"
        value={liquidity}
        icon={Wallet}
        color="bg-primary/15 text-primary"
        hidden={hidden}
      />
      <SummaryCard
        label="Receitas"
        value={monthlyIncome}
        icon={ArrowUpRight}
        color="bg-success/15 text-success"
        hidden={hidden}
      />
      <SummaryCard
        label="Despesas"
        value={monthlyExpenses}
        icon={ArrowDownRight}
        color="bg-danger/15 text-danger"
        hidden={hidden}
      />
      <SummaryCard
        label="Cartão de crédito"
        value={creditCardTotal}
        icon={CreditCard}
        color="bg-purple-500/15 text-purple-500"
        hidden={hidden}
      />
    </div>
  );
}
