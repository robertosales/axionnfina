import { Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";
import { useSessionUser } from "@/hooks/use-session-user";
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

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { signOut } = useSessionUser();

  const handleDelete = async () => {
    if (confirmText !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar");
      return;
    }

    setIsDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.id) {
        toast.error("Sessão inválida");
        return;
      }

      await logSecurityEvent({
        eventType: "account_deleted",
        severity: "critical",
        metadata: { action: "account_delete_initiated" },
      });

      const { error: deletionError } = await supabase.rpc("request_account_deletion", {
        p_reason: "Exclusão solicitada pelo usuário",
      });

      if (deletionError) {
        toast.error("Erro ao solicitar exclusão da conta");
        return;
      }

      await supabase.rpc("revoke_all_sessions");
      await supabase.auth.signOut();

      toast.success("Conta excluída com sucesso");
      onOpenChange(false);
      signOut();
    } catch {
      toast.error("Erro ao excluir conta");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Excluir Conta
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>Esta ação é irreversível. Todos os seus dados serão permanentemente removidos.</p>
              <p className="text-sm font-medium">
                Para confirmar, digite <code className="bg-muted px-1 rounded">EXCLUIR</code> no campo abaixo:
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <input
            type="text"
            placeholder="EXCLUIR"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== "EXCLUIR"}
            >
              {isDeleting ? "Excluindo..." : "Excluir conta permanentemente"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
