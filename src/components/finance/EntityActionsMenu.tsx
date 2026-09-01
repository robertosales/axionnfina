import { Archive, ArchiveRestore, Edit3, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type PendingAction = "archive" | "delete" | null;

type EntityActionsMenuProps = {
  entityLabel: string;
  recordName: string;
  archived?: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  deleteDisabledReason?: string | undefined;
  className?: string;
};

/** Menu consistente para o ciclo de vida de registros financeiros. */
export function EntityActionsMenu({
  entityLabel,
  recordName,
  archived = false,
  disabled = false,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  deleteDisabledReason,
  className,
}: EntityActionsMenuProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isDeleting = pendingAction === "delete";
  const title = isDeleting ? `Excluir ${entityLabel}?` : `Arquivar ${entityLabel}?`;
  const description = isDeleting
    ? `“${recordName}” será excluído permanentemente. Esta ação não pode ser desfeita.`
    : `“${recordName}” sairá das visões ativas, mas poderá ser restaurado depois.`;

  const confirm = () => {
    if (pendingAction === "delete") onDelete?.();
    if (pendingAction === "archive") onArchive?.();
    setPendingAction(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-8 shrink-0", className)}
            disabled={disabled}
            aria-label={`Ações de ${recordName}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onEdit && !archived && (
            <DropdownMenuItem onSelect={onEdit}>
              <Edit3 /> Editar
            </DropdownMenuItem>
          )}
          {archived && onRestore ? (
            <DropdownMenuItem onSelect={onRestore}>
              <ArchiveRestore /> Restaurar
            </DropdownMenuItem>
          ) : (
            onArchive && (
              <DropdownMenuItem onSelect={() => setPendingAction("archive")}>
                <Archive /> Arquivar
              </DropdownMenuItem>
            )
          )}
          {onDelete && <DropdownMenuSeparator />}
          {onDelete && (
            <DropdownMenuItem
              disabled={Boolean(deleteDisabledReason)}
              title={deleteDisabledReason}
              className="text-danger focus:bg-danger/10 focus:text-danger"
              onSelect={() => setPendingAction("delete")}
            >
              <Trash2 /> Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
            {isDeleting && deleteDisabledReason && (
              <p className="text-sm text-danger">{deleteDisabledReason}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              className={cn(
                isDeleting
                  ? "bg-danger text-danger-foreground hover:bg-danger/90"
                  : "bg-warning text-warning-foreground hover:bg-warning/90",
              )}
            >
              {isDeleting ? "Excluir permanentemente" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
