-- ============================================================
-- FASE 1: Segurança — Security Events, Devices, Sessions,
--          Notification Preferences, Audit Logs enhance
-- ============================================================

-- =============== TYPES ===============
CREATE TYPE public.severity_level AS ENUM ('low','medium','high','critical');
CREATE TYPE public.security_event_type AS ENUM (
  'login',
  'logout',
  'login_failed',
  'mfa_enabled',
  'mfa_disabled',
  'mfa_challenge_success',
  'mfa_challenge_failed',
  'password_changed',
  'password_reset_requested',
  'password_reset_completed',
  'account_connected',
  'account_removed',
  'consent_created',
  'consent_revoked',
  'payment_created',
  'payment_confirmed',
  'payment_cancelled',
  'payment_settled',
  'profile_changed',
  'investment_simulation',
  'recommendation_generated',
  'data_exported',
  'account_deleted',
  'session_revoked',
  'device_added',
  'device_removed',
  'suspicious_activity'
);

-- =============== AUDIT LOGS — ADD COLUMNS ===============
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_id uuid,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON public.audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =============== SECURITY EVENTS ===============
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.security_event_type NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'low',
  ip_address inet,
  user_agent text,
  device_id uuid,
  country text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_events_own_read ON public.security_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY security_events_own_insert ON public.security_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_security_events_user ON public.security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events(event_type, severity);
CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);

-- =============== USER DEVICES ===============
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  device_name text NOT NULL DEFAULT 'Dispositivo desconhecido',
  device_type text NOT NULL DEFAULT 'unknown',
  os text,
  browser text,
  is_trusted boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_devices_own ON public.user_devices
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_devices_updated_at BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_user_devices_fingerprint ON public.user_devices(user_id, device_fingerprint);

-- =============== USER SESSIONS METADATA ===============
CREATE TABLE public.user_sessions_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.user_devices(id) ON DELETE SET NULL,
  session_token_hash text,
  ip_address inet,
  user_agent text,
  country text,
  city text,
  is_active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_sessions_metadata TO authenticated;
GRANT ALL ON public.user_sessions_metadata TO service_role;
ALTER TABLE public.user_sessions_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_sessions_own ON public.user_sessions_metadata
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_sessions_user ON public.user_sessions_metadata(user_id, is_active, last_activity_at DESC);

-- =============== NOTIFICATION PREFERENCES ===============
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_prefs_own ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== RPC: log_security_event ===============
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type public.security_event_type,
  p_severity public.severity_level DEFAULT 'low',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_id uuid DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.security_events (
    user_id, event_type, severity, ip_address, user_agent, device_id, country, metadata
  ) VALUES (
    auth.uid(), p_event_type, p_severity, p_ip_address, p_user_agent, p_device_id, p_country, p_metadata
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_security_event(public.security_event_type, public.severity_level, inet, text, uuid, text, jsonb) TO authenticated;

-- =============== RPC: get_security_summary ===============
CREATE OR REPLACE FUNCTION public.get_security_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_events', (SELECT COUNT(*) FROM public.security_events WHERE user_id = auth.uid()),
    'recent_events', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', se.id,
        'event_type', se.event_type,
        'severity', se.severity,
        'ip_address', se.ip_address::text,
        'country', se.country,
        'created_at', se.created_at
      ))
      FROM (
        SELECT * FROM public.security_events
        WHERE user_id = auth.uid()
        ORDER BY created_at DESC
        LIMIT 10
      ) se
    ),
    'active_devices', (SELECT COUNT(*) FROM public.user_devices WHERE user_id = auth.uid()),
    'active_sessions', (SELECT COUNT(*) FROM public.user_sessions_metadata WHERE user_id = auth.uid() AND is_active = true),
    'failed_logins_24h', (
      SELECT COUNT(*) FROM public.security_events
      WHERE user_id = auth.uid()
        AND event_type = 'login_failed'
        AND created_at > now() - interval '24 hours'
    ),
    'suspicious_count', (
      SELECT COUNT(*) FROM public.security_events
      WHERE user_id = auth.uid()
        AND event_type = 'suspicious_activity'
        AND created_at > now() - interval '7 days'
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_security_summary() TO authenticated;

-- =============== RPC: revoke_device ===============
CREATE OR REPLACE FUNCTION public.revoke_device(p_device_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.user_devices
  SET is_trusted = false, updated_at = now()
  WHERE id = p_device_id AND user_id = auth.uid();

  UPDATE public.user_sessions_metadata
  SET is_active = false, ended_at = now()
  WHERE device_id = p_device_id AND user_id = auth.uid() AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_device(uuid) TO authenticated;

-- =============== RPC: revoke_all_sessions ===============
CREATE OR REPLACE FUNCTION public.revoke_all_sessions()
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.user_sessions_metadata
  SET is_active = false, ended_at = now()
  WHERE user_id = auth.uid() AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_all_sessions() TO authenticated;
