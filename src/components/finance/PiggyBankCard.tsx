import { Landmark, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import type { PiggyBank as PiggyBankType } from "@/hooks/use-piggy-banks";
import { EntityActionsMenu } from "./EntityActionsMenu";

interface PiggyBankCardProps {
  bank: PiggyBankType;
  onDeposit: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onDelete: () => void;
  archived?: boolean;
  onRestore?: () => void;
}

export function PiggyBankCard({
  bank,
  onDeposit,
  onWithdraw,
  onEdit,
  onDelete,
  archived = false,
  onRestore,
}: PiggyBankCardProps) {
  const hasGoal = bank.goal_id !== null;

  return (
    <Card className="overflow-hidden border-border/60 bg-card p-5 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-10 place-items-center rounded-full text-lg",
              bank.color ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
            style={bank.color ? { backgroundColor: `${bank.color}20`, color: bank.color } : undefined}
          >
            {bank.icon ?? <PiggyBank className="size-5" />}
          </div>
          <div>
            <h3 className="font-semibold">{bank.name}</h3>
            <p className="text-xs text-muted-foreground">
              {hasGoal ? "Vinculado a uma meta" : "Sem meta vinculada"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className="numeric text-lg font-semibold">{formatBRL(bank.balance)}</p>
            <p className="text-[11px] text-muted-foreground">saldo atual</p>
          </div>
          <EntityActionsMenu
            entityLabel="cofrinho"
            recordName={bank.name}
            archived={archived}
            onEdit={onEdit}
            onArchive={() => onDelete()}
            {...(onRestore ? { onRestore } : {})}
            {...(bank.balance === 0 ? { onDelete } : {})}
            deleteDisabledReason={
              bank.balance > 0 ? "Transfira ou resgate o saldo antes de excluir." : undefined
            }
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1"
          onClick={onDeposit}
        >
          <Landmark className="mr-1.5 size-3.5" />
          Aportar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 flex-1"
          onClick={onWithdraw}
          disabled={bank.balance <= 0}
        >
          Resgatar
        </Button>
      </div>
    </Card>
  );
}
