-- ============================================================
-- FASE 2 (b): Balance Snapshot Trigger
-- Cria snapshot automático quando saldo é atualizado
-- ============================================================

-- =============== TRIGGER: auto balance snapshot ===============
CREATE OR REPLACE FUNCTION public.auto_balance_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only snapshot when balance actually changes
  IF OLD.balance IS DISTINCT FROM NEW.balance OR OLD.available_balance IS DISTINCT FROM NEW.available_balance THEN
    INSERT INTO public.account_balances (user_id, account_id, balance, available_balance, source)
    VALUES (NEW.user_id, NEW.id, NEW.balance, NEW.available_balance, 'sync')
    ON CONFLICT (account_id, snapshot_date) DO UPDATE SET
      balance = EXCLUDED.balance,
      available_balance = EXCLUDED.available_balance,
      source = EXCLUDED.source;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_balance_snapshot
  AFTER UPDATE OF balance, available_balance ON public.accounts
  FOR EACH ROW
  WHEN (OLD.balance IS DISTINCT FROM NEW.balance OR OLD.available_balance IS DISTINCT FROM NEW.available_balance)
  EXECUTE FUNCTION public.auto_balance_snapshot();

-- =============== MATERIALIZED VIEW: mv_account_balances ===============
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_account_balances AS
SELECT
  a.user_id,
  a.id AS account_id,
  a.name AS account_name,
  a.type AS account_type,
  a.institution,
  a.balance AS current_balance,
  a.available_balance,
  a.currency,
  a.is_primary,
  a.last_sync_at,
  COALESCE(i.name, a.institution) AS institution_name,
  i.logo_color
FROM public.accounts a
LEFT JOIN public.institutions i ON i.id = a.institution_id
WHERE a.is_archived = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_account_balances_id ON public.mv_account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_mv_account_balances_user ON public.mv_account_balances(user_id);

-- =============== RPC: refresh_account_balances_view ===============
CREATE OR REPLACE FUNCTION public.refresh_account_balances_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_account_balances;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_account_balances_view() TO service_role;
