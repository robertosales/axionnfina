-- ============================================================
-- FASE 2: Carteira Multi-Contas
--          financial_accounts, account_connections,
--          account_balances, credit_cards
-- ============================================================

-- =============== TYPES ===============
CREATE TYPE public.connection_status AS ENUM ('active','inactive','error','pending');
CREATE TYPE public.card_brand AS ENUM ('visa','mastercard','elo','amex','other');

-- =============== EXTEND EXISTING accounts TABLE ===============
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS credit_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_external
  ON public.accounts(user_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_institution
  ON public.accounts(institution_id) WHERE institution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_primary
  ON public.accounts(user_id, is_primary) WHERE is_primary = true;

-- =============== account_connections ===============
CREATE TABLE public.account_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  consent_id uuid REFERENCES public.openfinance_consents(id) ON DELETE SET NULL,
  status public.connection_status NOT NULL DEFAULT 'pending',
  external_provider text NOT NULL DEFAULT 'pluggy',
  error_message text,
  last_sync_at timestamptz,
  sync_interval_minutes int NOT NULL DEFAULT 360,
  next_sync_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_connections TO authenticated;
GRANT ALL ON public.account_connections TO service_role;
ALTER TABLE public.account_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_connections_own ON public.account_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER account_connections_updated_at BEFORE UPDATE ON public.account_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_account_connections_user ON public.account_connections(user_id, status);
CREATE INDEX idx_account_connections_institution ON public.account_connections(institution_id);

-- =============== account_balances (historical snapshots) ===============
CREATE TABLE public.account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  available_balance numeric(14,2),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

GRANT SELECT, INSERT ON public.account_balances TO authenticated;
GRANT ALL ON public.account_balances TO service_role;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_balances_own ON public.account_balances
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_account_balances_account ON public.account_balances(account_id, snapshot_date DESC);
CREATE INDEX idx_account_balances_user_date ON public.account_balances(user_id, snapshot_date DESC);

-- =============== credit_cards ===============
CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  last_four text NOT NULL,
  brand public.card_brand NOT NULL DEFAULT 'other',
  holder_name text NOT NULL DEFAULT '',
  expiration_month int,
  expiration_year int,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  available_limit numeric(14,2),
  closing_day int,
  due_day int,
  is_virtual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_cards_own ON public.credit_cards
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER credit_cards_updated_at BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_credit_cards_account ON public.credit_cards(account_id);

-- =============== RPC: create_balance_snapshot ===============
CREATE OR REPLACE FUNCTION public.create_balance_snapshot(
  p_account_id uuid,
  p_balance numeric,
  p_available_balance numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.accounts WHERE id = p_account_id AND user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  INSERT INTO public.account_balances (user_id, account_id, balance, available_balance, source)
  VALUES (v_user_id, p_account_id, p_balance, p_available_balance, 'manual')
  ON CONFLICT (account_id, snapshot_date) DO UPDATE SET
    balance = EXCLUDED.balance,
    available_balance = EXCLUDED.available_balance,
    source = EXCLUDED.source
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_balance_snapshot(uuid, numeric, numeric) TO authenticated;

-- =============== RPC: get_wallet_summary ===============
CREATE OR REPLACE FUNCTION public.get_wallet_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'total_accounts', COUNT(*),
        'checking_count', COUNT(*) FILTER (WHERE type = 'checking'),
        'savings_count', COUNT(*) FILTER (WHERE type = 'savings'),
        'credit_count', COUNT(*) FILTER (WHERE type = 'credit'),
        'investment_count', COUNT(*) FILTER (WHERE type = 'investment'),
        'total_balance', COALESCE(SUM(balance), 0),
        'liquid_balance', COALESCE(SUM(balance) FILTER (WHERE type IN ('checking','savings')), 0),
        'investment_balance', COALESCE(SUM(balance) FILTER (WHERE type = 'investment'), 0),
        'total_credit_limit', COALESCE(SUM(credit_limit), 0),
        'total_available_credit', COALESCE(SUM(available_balance), 0)
      )
      FROM public.accounts
      WHERE user_id = auth.uid() AND is_archived = false
    ),
    'by_institution', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'name', COALESCE(i.name, a.institution, 'Outros'),
          'logo_color', i.logo_color,
          'account_count', COUNT(*),
          'balance', SUM(a.balance)
        ) AS t
        FROM public.accounts a
        LEFT JOIN public.institutions i ON i.id = a.institution_id
        WHERE a.user_id = auth.uid() AND a.is_archived = false
        GROUP BY i.name, a.institution, i.logo_color
        ORDER BY SUM(a.balance) DESC
      ) bi
    ),
    'accounts', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'institution_name', COALESCE(i.name, a.institution),
          'logo_color', i.logo_color,
          'type', a.type,
          'balance', a.balance,
          'available_balance', a.available_balance,
          'is_primary', a.is_primary,
          'is_manual', a.is_manual,
          'open_finance', a.open_finance,
          'card_last_four', cc.last_four,
          'card_brand', cc.brand,
          'last_sync_at', a.last_sync_at,
          'currency', a.currency
        ) AS t
        FROM public.accounts a
        LEFT JOIN public.institutions i ON i.id = a.institution_id
        LEFT JOIN public.credit_cards cc ON cc.account_id = a.id
        WHERE a.user_id = auth.uid() AND a.is_archived = false
        ORDER BY a.is_primary DESC, a.balance DESC
      ) acc
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary() TO authenticated;

-- =============== RPC: upsert_account ===============
CREATE OR REPLACE FUNCTION public.upsert_account(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_external_id text;
BEGIN
  v_external_id := p_data->>'external_id';

  -- Try to find existing account by external_id
  IF v_external_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.accounts
    WHERE user_id = auth.uid() AND external_id = v_external_id;

    IF v_id IS NOT NULL THEN
      UPDATE public.accounts SET
        name = COALESCE(p_data->>'name', name),
        institution = COALESCE(p_data->>'institution', institution),
        institution_id = NULLIF(p_data->>'institution_id','')::uuid,
        type = COALESCE(p_data->>'type', type),
        balance = COALESCE((p_data->>'balance')::numeric, balance),
        available_balance = COALESCE((p_data->>'available_balance')::numeric, available_balance),
        credit_limit = COALESCE((p_data->>'credit_limit')::numeric, credit_limit),
        currency = COALESCE(p_data->>'currency', currency),
        subtype = COALESCE(p_data->>'subtype', subtype),
        is_manual = COALESCE((p_data->>'is_manual')::boolean, is_manual),
        last_sync_at = CASE WHEN p_data ? 'last_sync_at' THEN (p_data->>'last_sync_at')::timestamptz ELSE last_sync_at END,
        metadata = COALESCE(p_data->'metadata', metadata)
      WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;

  -- Insert new account
  INSERT INTO public.accounts (
    user_id, name, institution, institution_id, type, balance,
    available_balance, credit_limit, currency, subtype,
    is_primary, is_manual, open_finance, external_id, metadata
  ) VALUES (
    auth.uid(),
    COALESCE(p_data->>'name', 'Nova conta'),
    COALESCE(p_data->>'institution', ''),
    NULLIF(p_data->>'institution_id','')::uuid,
    COALESCE(p_data->>'type')::public.account_type,
    COALESCE((p_data->>'balance')::numeric, 0),
    (p_data->>'available_balance')::numeric,
    (p_data->>'credit_limit')::numeric,
    COALESCE(p_data->>'currency', 'BRL'),
    p_data->>'subtype',
    COALESCE((p_data->>'is_primary')::boolean, false),
    COALESCE((p_data->>'is_manual')::boolean, true),
    COALESCE((p_data->>'open_finance')::boolean, false),
    v_external_id,
    COALESCE(p_data->'metadata', '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_account(jsonb) TO authenticated;

-- =============== RPC: archive_account ===============
CREATE OR REPLACE FUNCTION public.archive_account(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.accounts
  SET is_archived = true, updated_at = now()
  WHERE id = p_account_id AND user_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_account(uuid) TO authenticated;

-- =============== RPC: set_primary_account ===============
CREATE OR REPLACE FUNCTION public.set_primary_account(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Unset all primary
  UPDATE public.accounts SET is_primary = false WHERE user_id = auth.uid();

  -- Set new primary
  UPDATE public.accounts
  SET is_primary = true, updated_at = now()
  WHERE id = p_account_id AND user_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_primary_account(uuid) TO authenticated;

-- =============== RPC: create_connection ===============
CREATE OR REPLACE FUNCTION public.create_connection(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.account_connections (
    user_id, institution_id, consent_id, status,
    external_provider, sync_interval_minutes, metadata
  ) VALUES (
    auth.uid(),
    (p_data->>'institution_id')::uuid,
    NULLIF(p_data->>'consent_id','')::uuid,
    COALESCE(p_data->>'status')::public.connection_status,
    COALESCE(p_data->>'external_provider', 'pluggy'),
    COALESCE((p_data->>'sync_interval_minutes')::int, 360),
    COALESCE(p_data->'metadata', '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_connection(jsonb) TO authenticated;
