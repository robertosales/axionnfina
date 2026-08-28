-- ============================================================
-- FASE 3: Open Finance — Sync, Webhooks, Observability
-- ============================================================

-- =============== TYPES ===============
CREATE TYPE public.sync_status AS ENUM ('pending','running','completed','failed','cancelled');
CREATE TYPE public.webhook_event_status AS ENUM ('received','processing','processed','failed','duplicate');

-- =============== openfinance_syncs ===============
CREATE TABLE public.openfinance_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status public.sync_status NOT NULL DEFAULT 'pending',
  accounts_imported int NOT NULL DEFAULT 0,
  balances_imported int NOT NULL DEFAULT 0,
  transactions_imported int NOT NULL DEFAULT 0,
  investments_imported int NOT NULL DEFAULT 0,
  duplicates_skipped int NOT NULL DEFAULT 0,
  duration_ms int,
  errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.openfinance_syncs TO authenticated;
GRANT ALL ON public.openfinance_syncs TO service_role;
ALTER TABLE public.openfinance_syncs ENABLE ROW LEVEL SECURITY;
CREATE POLICY openfinance_syncs_own ON public.openfinance_syncs
  FOR ALL TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.account_connections WHERE user_id = auth.uid()
  ));
CREATE INDEX idx_openfinance_syncs_connection ON public.openfinance_syncs(connection_id, created_at DESC);
CREATE INDEX idx_openfinance_syncs_status ON public.openfinance_syncs(status, created_at DESC);

-- =============== openfinance_sync_errors ===============
CREATE TABLE public.openfinance_sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  sync_id uuid REFERENCES public.openfinance_syncs(id) ON DELETE SET NULL,
  provider text NOT NULL,
  error_code text NOT NULL,
  message text NOT NULL,
  entity text NOT NULL,
  provider_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.openfinance_sync_errors TO authenticated;
GRANT ALL ON public.openfinance_sync_errors TO service_role;
ALTER TABLE public.openfinance_sync_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY openfinance_sync_errors_own ON public.openfinance_sync_errors
  FOR ALL TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.account_connections WHERE user_id = auth.uid()
  ));
CREATE INDEX idx_openfinance_sync_errors_connection ON public.openfinance_sync_errors(connection_id, created_at DESC);

-- =============== provider_webhook_events ===============
CREATE TABLE public.provider_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  status public.webhook_event_status NOT NULL DEFAULT 'received',
  payload_hash text,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);

GRANT ALL ON public.provider_webhook_events TO service_role;
ALTER TABLE public.provider_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_webhook_events_service_only ON public.provider_webhook_events
  FOR ALL TO service_role USING (true);
CREATE INDEX idx_provider_webhook_events_provider ON public.provider_webhook_events(provider, created_at DESC);
CREATE INDEX idx_provider_webhook_events_status ON public.provider_webhook_events(status, created_at DESC);

-- =============== RPC: get_sync_history ===============
CREATE OR REPLACE FUNCTION public.get_sync_history(
  p_connection_id uuid,
  p_limit int DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'status', s.status,
      'accounts_imported', s.accounts_imported,
      'balances_imported', s.balances_imported,
      'transactions_imported', s.transactions_imported,
      'investments_imported', s.investments_imported,
      'duplicates_skipped', s.duplicates_skipped,
      'duration_ms', s.duration_ms,
      'errors', s.errors,
      'created_at', s.created_at
    ) AS t
    FROM public.openfinance_syncs s
    WHERE s.connection_id IN (
      SELECT id FROM public.account_connections WHERE user_id = auth.uid()
    )
    ORDER BY s.created_at DESC
    LIMIT p_limit
  ) sub;
$$;
GRANT EXECUTE ON FUNCTION public.get_sync_history(uuid, int) TO authenticated;

-- =============== RPC: get_sync_errors ===============
CREATE OR REPLACE FUNCTION public.get_sync_errors(
  p_connection_id uuid,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'error_code', e.error_code,
      'message', e.message,
      'entity', e.entity,
      'provider_error', e.provider_error,
      'created_at', e.created_at
    ) AS t
    FROM public.openfinance_sync_errors e
    WHERE e.connection_id IN (
      SELECT id FROM public.account_connections WHERE user_id = auth.uid()
    )
    ORDER BY e.created_at DESC
    LIMIT p_limit
  ) sub;
$$;
GRANT EXECUTE ON FUNCTION public.get_sync_errors(uuid, int) TO authenticated;

-- =============== RPC: trigger_sync ===============
CREATE OR REPLACE FUNCTION public.trigger_sync(p_connection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_conn record;
  v_sync_id uuid;
BEGIN
  -- Verify ownership
  SELECT * INTO v_conn
  FROM public.account_connections
  WHERE id = p_connection_id AND user_id = auth.uid();

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'Connection not found or access denied';
  END IF;

  -- Create sync record
  INSERT INTO public.openfinance_syncs (connection_id, provider, status)
  VALUES (p_connection_id, v_conn.provider, 'running')
  RETURNING id INTO v_sync_id;

  -- Update connection status
  UPDATE public.account_connections
  SET status = 'active', updated_at = now()
  WHERE id = p_connection_id;

  RETURN jsonb_build_object(
    'sync_id', v_sync_id,
    'status', 'running',
    'message', 'Sync initiated. In production, this triggers the provider sync.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.trigger_sync(uuid) TO authenticated;
