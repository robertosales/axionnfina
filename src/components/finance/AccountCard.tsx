import { Building2, CreditCard, Landmark, LineChart, PiggyBank, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSyncAccount } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Account } from "@/shared/finance-types";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

const typeMeta = {
  CHECKING: { icon: Landmark, label: "Conta corrente" },
  SAVINGS: { icon: PiggyBank, label: "Poupança" },
  CREDIT_CARD: { icon: CreditCard, label: "Cartão de crédito" },
  INVESTMENT: { icon: LineChart, label: "Investimentos" },
} as const;

function syncLabel(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "não informada";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `há ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function AccountCard({ account }: { account: Account }) {
  const syncAccount = useSyncAccount();
  const meta = typeMeta[account.type] ?? { icon: Building2, label: "Conta" };
  const Icon = meta.icon;
  const negative = account.balance < 0;

  return (
    <Card className="flex min-w-0 flex-row flex-wrap items-center gap-4 rounded-2xl border-border/40 p-5 shadow-elevation-1">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 basis-[min(14rem,100%)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{account.institution}</p>
          {account.openFinance && (
            <Badge variant="outline" className="rounded-full text-[10px]">
              Open Finance
            </Badge>
          )}
        </div>
        <p className="break-words text-xs text-muted-foreground">
          {meta.label} ·{" "}
          {account.openFinance
            ? `Sincronização ${syncLabel(account.lastSyncedAt)}`
            : account.recordOrigin === "import"
              ? "Importada"
              : "Manual"}
        </p>
      </div>

      <div className="ml-auto min-w-0 max-w-full text-right">
        <p
          className={cn(
            "numeric break-words text-lg font-semibold",
            negative ? "text-expense" : "text-foreground",
          )}
        >
          {formatBRL(account.balance)}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2 text-xs text-muted-foreground"
          onClick={() =>
            syncAccount.mutate(account.id, {
              onError: () => toast.error("Não foi possível sincronizar. Verifique a conexão."),
              onSuccess: () => toast.success("Sincronização solicitada."),
            })
          }
          disabled={!account.openFinance || !account.connectionId || syncAccount.isPending}
          title={
            account.openFinance
              ? "Sincronizar dados da conta"
              : "Ative o Open Finance para sincronizar"
          }
        >
          <RefreshCw className="size-3" /> Sincronizar
        </Button>
        {account.openFinance && (
          <Link
            to="/wallet/connect"
            className="focus-ring block rounded text-xs text-primary underline"
          >
            Gerenciar conexão
          </Link>
        )}
      </div>
    </Card>
  );
}
