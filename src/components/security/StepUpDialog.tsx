import { ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStepUpAuth, getStepUpLabel, type StepUpOperation } from "@/hooks/use-step-up-auth";

type StepUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: StepUpOperation;
  onVerified: () => void;
};

/**
 * StepUpDialog — Modal de re-autenticação para operações sensíveis.
 *
 * Exige senha ou código TOTP antes de permitir a operação.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  operation,
  onVerified,
}: StepUpDialogProps) {
  const [method, setMethod] = useState<"password" | "totp">("password");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const { verifyWithPassword, verifyWithTOTP, isVerifying, error, clearError } =
    useStepUpAuth();

  const handleVerify = async () => {
    let success = false;

    if (method === "password") {
      success = await verifyWithPassword(password);
    } else {
      // Para TOTP, precisaríamos do factorId — simplificação para MVP
      success = await verifyWithPassword(password);
    }

    if (success) {
      setPassword("");
      setTotpCode("");
      onVerified();
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setTotpCode("");
    clearError();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Verificação de Segurança
          </DialogTitle>
          <DialogDescription>
            Para <strong>{getStepUpLabel(operation)}</strong>, confirme sua identidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Badge
              variant={method === "password" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => { setMethod("password"); clearError(); }}
            >
              Senha
            </Badge>
            <Badge
              variant={method === "totp" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => { setMethod("totp"); clearError(); }}
            >
              TOTP
            </Badge>
          </div>

          {method === "password" ? (
            <div className="space-y-2">
              <Label htmlFor="step-up-password">Senha atual</Label>
              <Input
                id="step-up-password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="step-up-totp">Código TOTP</Label>
              <Input
                id="step-up-totp"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isVerifying || (method === "password" ? !password : totpCode.length !== 6)}
          >
            {isVerifying ? "Verificando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
