import { ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";
import { Button } from "@/components/ui/button";
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

type RevokeConsentButtonProps = {
  provider?: string;
};

export function RevokeConsentButton({ provider = "google" }: RevokeConsentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        toast.error("Sessão inválida");
        return;
      }

      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/revoke?token=${session.session.access_token}`,
        { method: "POST" }
      ).catch(() => null);

      await supabase.auth.signOut({ scope: "global" });

      await logSecurityEvent({
        eventType: "consent_revoked",
        severity: "medium",
        metadata: { provider, method: "oauth_revoke" },
      });

      toast.success("Consentimentos revogados com sucesso");
      setOpen(false);
    } catch {
      toast.error("Erro ao revogar consentimentos");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <XCircle className="mr-2 size-4" />
        Revogar consentimentos
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Revogar Consentimentos
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar todos os consentimentos de{" "}
              <strong>{provider === "google" ? "Google" : provider}</strong>?
              Isso removerá o acesso à sua conta e encerrará todas as sessões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleRevoke}
                disabled={isRevoking}
              >
                {isRevoking ? "Revogando..." : "Revogar consentimentos"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
