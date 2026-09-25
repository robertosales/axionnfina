-- ============================================================
-- LGPD: Consentimentos, Exportação e Exclusão de Dados
-- ============================================================

-- =============== TYPES ===============
DO $$ BEGIN
  CREATE TYPE public.consent_purpose AS ENUM (
    'data_processing',
    'analytics',
    'marketing',
    'open_finance',
    'ai_processing',
    'third_party_sharing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.consent_status AS ENUM ('granted', 'revoked', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============== LGPD CONSENTS ===============
CREATE TABLE public.lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose public.consent_purpose NOT NULL,
  status public.consent_status NOT NULL DEFAULT 'pending',
  description text NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, purpose)
);

GRANT SELECT, INSERT, UPDATE ON public.lgpd_consents TO authenticated;
GRANT ALL ON public.lgpd_consents TO service_role;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY lgpd_consents_own ON public.lgpd_consents
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER lgpd_consents_updated_at BEFORE UPDATE ON public.lgpd_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_lgpd_consents_user ON public.lgpd_consents(user_id, purpose);

-- =============== LGPD DATA REQUESTS ===============
DO $$ BEGIN
  CREATE TYPE public.lgpd_request_type AS ENUM ('export', 'deletion', 'rectification', 'portability');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.lgpd_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type public.lgpd_request_type NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  download_url text,
  download_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.lgpd_data_requests TO authenticated;
GRANT ALL ON public.lgpd_data_requests TO service_role;
ALTER TABLE public.lgpd_data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY lgpd_data_requests_own ON public.lgpd_data_requests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER lgpd_data_requests_updated_at BEFORE UPDATE ON public.lgpd_data_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_lgpd_data_requests_user ON public.lgpd_data_requests(user_id, status);

-- =============== USER PRIVACY SETTINGS ===============
CREATE TABLE public.user_privacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mask_sensitive_data boolean NOT NULL DEFAULT true,
  data_retention_days int NOT NULL DEFAULT 365,
  allow_analytics boolean NOT NULL DEFAULT false,
  allow_marketing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_privacy_settings TO authenticated;
GRANT ALL ON public.user_privacy_settings TO service_role;
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_privacy_settings_own ON public.user_privacy_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_privacy_settings_updated_at BEFORE UPDATE ON public.user_privacy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== RPC: grant_consent ===============
CREATE OR REPLACE FUNCTION public.grant_consent(
  p_purpose public.consent_purpose,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.lgpd_consents (user_id, purpose, status, description, granted_at)
  VALUES (auth.uid(), p_purpose, 'granted', p_description, now())
  ON CONFLICT (user_id, purpose) DO UPDATE
    SET status = 'granted',
        description = EXCLUDED.description,
        granted_at = now(),
        revoked_at = NULL,
        updated_at = now()
  RETURNING id INTO v_id;

  -- Log security event
  INSERT INTO public.security_events (user_id, event_type, severity, metadata)
  VALUES (auth.uid(), 'consent_created', 'low', jsonb_build_object('purpose', p_purpose));

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.grant_consent(public.consent_purpose, text) TO authenticated;

-- =============== RPC: revoke_consent ===============
CREATE OR REPLACE FUNCTION public.revoke_consent(
  p_purpose public.consent_purpose
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.lgpd_consents
  SET status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
    AND purpose = p_purpose
    AND status = 'granted';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.security_events (user_id, event_type, severity, metadata)
    VALUES (auth.uid(), 'consent_revoked', 'low', jsonb_build_object('purpose', p_purpose));
  END IF;

  RETURN v_count > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_consent(public.consent_purpose) TO authenticated;

-- =============== RPC: get_user_consents ===============
CREATE OR REPLACE FUNCTION public.get_user_consents()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'purpose', lc.purpose,
      'status', lc.status,
      'description', lc.description,
      'granted_at', lc.granted_at,
      'revoked_at', lc.revoked_at
    )),
    '[]'::jsonb
  )
  FROM public.lgpd_consents lc
  WHERE lc.user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_user_consents() TO authenticated;

-- =============== RPC: request_data_export ===============
CREATE OR REPLACE FUNCTION public.request_data_export()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_request_count int;
BEGIN
  -- Rate limit: 1 request per 24h
  SELECT COUNT(*) INTO v_request_count
  FROM public.lgpd_data_requests
  WHERE user_id = auth.uid()
    AND request_type = 'export'
    AND created_at > now() - interval '24 hours';

  IF v_request_count > 0 THEN
    RAISE EXCEPTION 'Aguarde 24 horas entre solicitações de exportação';
  END IF;

  INSERT INTO public.lgpd_data_requests (user_id, request_type, status)
  VALUES (auth.uid(), 'export', 'pending')
  RETURNING id INTO v_id;

  INSERT INTO public.security_events (user_id, event_type, severity, metadata)
  VALUES (auth.uid(), 'data_exported', 'medium', jsonb_build_object('request_id', v_id));

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_data_export() TO authenticated;

-- =============== RPC: request_account_deletion ===============
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.lgpd_data_requests (user_id, request_type, status, metadata)
  VALUES (
    auth.uid(),
    'deletion',
    'pending',
    jsonb_build_object('reason', p_reason)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.security_events (user_id, event_type, severity, metadata)
  VALUES (auth.uid(), 'account_deleted', 'critical', jsonb_build_object('request_id', v_id));

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;

-- =============== RPC: get_privacy_settings ===============
CREATE OR REPLACE FUNCTION public.get_privacy_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'mask_sensitive_data', ups.mask_sensitive_data,
      'data_retention_days', ups.data_retention_days,
      'allow_analytics', ups.allow_analytics,
      'allow_marketing', ups.allow_marketing
    )
    FROM public.user_privacy_settings ups
    WHERE ups.user_id = auth.uid()),
    jsonb_build_object(
      'mask_sensitive_data', true,
      'data_retention_days', 365,
      'allow_analytics', false,
      'allow_marketing', false
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_privacy_settings() TO authenticated;

-- =============== RPC: update_privacy_settings ===============
CREATE OR REPLACE FUNCTION public.update_privacy_settings(
  p_mask_sensitive_data boolean DEFAULT NULL,
  p_data_retention_days int DEFAULT NULL,
  p_allow_analytics boolean DEFAULT NULL,
  p_allow_marketing boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_privacy_settings (
    user_id, mask_sensitive_data, data_retention_days, allow_analytics, allow_marketing
  )
  VALUES (
    auth.uid(),
    COALESCE(p_mask_sensitive_data, true),
    COALESCE(p_data_retention_days, 365),
    COALESCE(p_allow_analytics, false),
    COALESCE(p_allow_marketing, false)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    mask_sensitive_data = COALESCE(p_mask_sensitive_data, user_privacy_settings.mask_sensitive_data),
    data_retention_days = COALESCE(p_data_retention_days, user_privacy_settings.data_retention_days),
    allow_analytics = COALESCE(p_allow_analytics, user_privacy_settings.allow_analytics),
    allow_marketing = COALESCE(p_allow_marketing, user_privacy_settings.allow_marketing),
    updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_privacy_settings(boolean, int, boolean, boolean) TO authenticated;
