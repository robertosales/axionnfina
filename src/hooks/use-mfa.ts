import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useMFA — Hooks para gerenciar Autenticação Multifator (TOTP).
 *
 * O Supabase suporta TOTP nativamente via `supabase.auth.mfa`.
 */

export type MFAFactor = {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
  created_at: string;
};

/**
 * Lista fatores MFA do usuário.
 */
export function useMFAFactors() {
  return useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async (): Promise<MFAFactor[]> => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return (data?.totp as MFAFactor[]) ?? [];
    },
  });
}

/**
 * Verifica se o usuário tem MFA habilitado.
 */
export function useMFAEnabled() {
  const { data: factors, isLoading } = useMFAFactors();
  return {
    enabled: (factors?.length ?? 0) > 0,
    isLoading,
  };
}

/**
 * Enroll — cria um novo fator TOTP.
 */
export function useMFAEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendlyName: string) => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (error) throw error;
      return data; // { id, totp: { qr_code, secret, uri } }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    },
  });
}

/**
 * Challenge — inicia um challenge para um fator.
 */
export function useMFAChallenge() {
  return useMutation({
    mutationFn: async (factorId: string) => {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      return data; // { id }
    },
  });
}

/**
 * Verify — verifica o código TOTP.
 */
export function useMFAVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { factorId: string; challengeId: string; code: string }) => {
      const { error } = await supabase.auth.mfa.verify({
        factorId: params.factorId,
        challengeId: params.challengeId,
        code: params.code,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    },
  });
}

/**
 * Unenroll — remove um fator TOTP.
 */
export function useMFAUnenroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    },
  });
}

/**
 * Get Authenticator-assisted recovery codes.
 */
export function useMFARecoveryCodes() {
  return useQuery({
    queryKey: ["mfa-recovery-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
  });
}
