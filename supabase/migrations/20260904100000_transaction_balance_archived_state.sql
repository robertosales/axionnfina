-- Transacoes arquivadas nao participam do saldo exibido da conta.
-- Open Finance continua usando o saldo autoritativo informado pelo provedor.

CREATE OR REPLACE FUNCTION public.transaction_balance_delta(
  p_account_id uuid,
  p_amount numeric,
  p_status public.transaction_status,
  p_record_origin text,
  p_archived_at timestamptz DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_account_id IS NULL
      OR p_status <> 'settled'
      OR p_record_origin = 'open_finance'
      OR p_archived_at IS NOT NULL
    THEN 0
    ELSE COALESCE(p_amount, 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_transaction_account_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_delta numeric := 0;
  v_next_delta numeric := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_previous_delta := public.transaction_balance_delta(
      OLD.account_id, OLD.amount, OLD.status, OLD.record_origin, OLD.archived_at
    );
    PERFORM public.apply_transaction_balance_delta(OLD.account_id, -v_previous_delta);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_next_delta := public.transaction_balance_delta(
      NEW.account_id, NEW.amount, NEW.status, NEW.record_origin, NEW.archived_at
    );
    PERFORM public.apply_transaction_balance_delta(NEW.account_id, v_next_delta);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS transactions_sync_account_balance ON public.transactions;
CREATE TRIGGER transactions_sync_account_balance
AFTER INSERT OR UPDATE OF account_id, amount, status, record_origin, archived_at OR DELETE
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_account_balance();

REVOKE ALL ON FUNCTION public.transaction_balance_delta(uuid, numeric, public.transaction_status, text, timestamptz) FROM PUBLIC;