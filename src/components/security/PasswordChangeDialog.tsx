import { Key, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PasswordChangeDialog({
  open,
  onOpenChange,
}: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setError(null);

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.email) {
        setError("Sessão inválida. Faça login novamente.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) {
        setError("Não foi possível alterar a senha");
        await logSecurityEvent({
          eventType: "password_changed",
          severity: "medium",
          metadata: { reason: "password_update_failed" },
        });
        return;
      }

      await logSecurityEvent({
        eventType: "password_changed",
        severity: "low",
        metadata: { method: "password_change" },
      });

      toast.success("Senha alterada com sucesso");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch {
      setError("Erro ao alterar senha");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5 text-primary" />
            Alterar Senha
          </DialogTitle>
          <DialogDescription>
            Digite sua senha atual e a nova senha desejada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Nova senha (mínimo 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
          >
            {isSubmitting ? "Alterando..." : "Alterar senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
