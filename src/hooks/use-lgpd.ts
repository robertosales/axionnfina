import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ConsentPurpose =
  | "data_processing"
  | "analytics"
  | "marketing"
  | "open_finance"
  | "ai_processing"
  | "third_party_sharing";

export type ConsentStatus = "granted" | "revoked" | "pending";

export interface Consent {
  purpose: ConsentPurpose;
  status: ConsentStatus;
  description: string;
  granted_at: string | null;
  revoked_at: string | null;
}

export interface PrivacySettings {
  mask_sensitive_data: boolean;
  data_retention_days: number;
  allow_analytics: boolean;
  allow_marketing: boolean;
}

/* ------------------------------------------------------------------ */
/* Consentments                                                         */
/* ------------------------------------------------------------------ */

export function useConsents() {
  return useQuery({
    queryKey: ["lgpd-consents"],
    queryFn: async (): Promise<Consent[]> => {
      const { data, error } = await supabase.rpc("get_user_consents");
      if (error) throw error;
      return (data as unknown as Consent[]) ?? [];
    },
  });
}

export function useGrantConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      purpose,
      description,
    }: {
      purpose: ConsentPurpose;
      description: string;
    }) => {
      const { data, error } = await supabase.rpc("grant_consent", {
        p_purpose: purpose,
        p_description: description,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lgpd-consents"] });
    },
  });
}

export function useRevokeConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (purpose: ConsentPurpose) => {
      const { data, error } = await supabase.rpc("revoke_consent", {
        p_purpose: purpose,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lgpd-consents"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Privacy Settings                                                     */
/* ------------------------------------------------------------------ */

export function usePrivacySettings() {
  return useQuery({
    queryKey: ["privacy-settings"],
    queryFn: async (): Promise<PrivacySettings> => {
      const { data, error } = await supabase.rpc("get_privacy_settings");
      if (error) throw error;
      return data as unknown as PrivacySettings;
    },
  });
}

export function useUpdatePrivacySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<PrivacySettings>) => {
      const { error } = await supabase.rpc("update_privacy_settings", {
        ...(settings.mask_sensitive_data !== undefined && { p_mask_sensitive_data: settings.mask_sensitive_data }),
        ...(settings.data_retention_days !== undefined && { p_data_retention_days: settings.data_retention_days }),
        ...(settings.allow_analytics !== undefined && { p_allow_analytics: settings.allow_analytics }),
        ...(settings.allow_marketing !== undefined && { p_allow_marketing: settings.allow_marketing }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["privacy-settings"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Data Export                                                           */
/* ------------------------------------------------------------------ */

export function useRequestDataExport() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_data_export");
      if (error) throw error;
      return data as string;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Account Deletion                                                     */
/* ------------------------------------------------------------------ */

export function useRequestAccountDeletion() {
  return useMutation({
    mutationFn: async ({ reason }: { reason?: string }) => {
      const { data, error } = await supabase.rpc("request_account_deletion", reason !== undefined ? { p_reason: reason } : {});
      if (error) throw error;
      return data as string;
    },
  });
}
