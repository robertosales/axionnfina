import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";

/**
 * useStepUpAuth — Hook para autenticação reforçada (step-up).
 *
 * Exigido para operações sensíveis: pagamentos, alteração de senha, exclusão de conta, etc.
 *
 * Fluxo:
 * 1. Usuário inicia operação sensível
 * 2. Sistema exige re-autenticação (senha ou MFA)
 * 3. Após verificação, operação é autorizada
 */

export type StepUpOperation =
  | "pix_send"
  | "transfer"
  | "password_change"
  | "mfa_change"
  | "account_delete"
  | "consent_revoke"
  | "email_change"
  | "data_export"
  | "payment_create"
  | "payment_confirm";

const SENSITIVE_OP_LABELS: Record<StepUpOperation, string> = {
  pix_send: "Enviar Pix",
  transfer: "Transferência",
  password_change: "Alteração de senha",
  mfa_change: "Alteração de MFA",
  account_delete: "Exclusão de conta",
  consent_revoke: "Revogação de consentimento",
  email_change: "Alteração de e-mail",
  data_export: "Exportação de dados",
  payment_create: "Criação de pagamento",
  payment_confirm: "Confirmação de pagamento",
};

export function getStepUpLabel(operation: StepUpOperation): string {
  return SENSITIVE_OP_LABELS[operation] ?? operation;
}

/**
 * Verifica se o usuário passou recentemente por step-up auth.
 * Se não, retorna true (precisa de step-up).
 */
export async function checkStepUpStatus(
  operation: StepUpOperation,
): Promise<{
  required: boolean;
  reason?: string;
}> {
  // Verificar se há sessão ativa com auth recente
  const { data: session } = await supabase.auth.getSession();

  if (!session.session) {
    return { required: true, reason: "Sessão não encontrada" };
  }

  // Em produção, verificar timestamp da última autenticação
  // e comparar com threshold do tipo de operação
  const lastAuthAt = new Date(
    session.session.user.last_sign_in_at ?? session.session.user.created_at,
  );
  const now = new Date();
  const minutesSinceAuth = (now.getTime() - lastAuthAt.getTime()) / (1000 * 60);

  // Operações críticas exigem autenticação nos últimos 5 minutos
  const criticalOps: StepUpOperation[] = [
    "account_delete",
    "mfa_change",
    "password_change",
  ];
  const threshold = criticalOps.includes(operation) ? 5 : 15;

  if (minutesSinceAuth > threshold) {
    return {
      required: true,
      reason: `Última autenticação há ${Math.round(minutesSinceAuth)} minutos`,
    };
  }

  return { required: false };
}

/**
 * Hook para gerenciar fluxo de step-up authentication.
 */
export function useStepUpAuth() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyWithPassword = useCallback(
    async (password: string): Promise<boolean> => {
      setIsVerifying(true);
      setError(null);

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user?.email) {
          setError("Sessão inválida");
          return false;
        }

        // Re-autenticar com email + senha
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: session.session.user.email,
          password,
        });

        if (authError) {
          setError("Senha incorreta");
          await logSecurityEvent({
            eventType: "mfa_challenge_failed",
            severity: "medium",
            metadata: { reason: "step-up password verification failed" },
          });
          return false;
        }

        await logSecurityEvent({
          eventType: "mfa_challenge_success",
          severity: "low",
          metadata: { method: "password" },
        });

        return true;
      } catch (err) {
        setError("Erro ao verificar credenciais");
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [],
  );

  const verifyWithTOTP = useCallback(
    async (factorId: string, code: string): Promise<boolean> => {
      setIsVerifying(true);
      setError(null);

      try {
        // Criar challenge
        const { data: challenge, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId });

        if (challengeError) {
          setError("Erro ao criar challenge");
          return false;
        }

        // Verificar código
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        });

        if (verifyError) {
          setError("Código TOTP inválido");
          await logSecurityEvent({
            eventType: "mfa_challenge_failed",
            severity: "medium",
            metadata: { reason: "step-up TOTP verification failed" },
          });
          return false;
        }

        await logSecurityEvent({
          eventType: "mfa_challenge_success",
          severity: "low",
          metadata: { method: "totp" },
        });

        return true;
      } catch (err) {
        setError("Erro ao verificar TOTP");
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    verifyWithPassword,
    verifyWithTOTP,
    isVerifying,
    error,
    clearError,
  };
}
