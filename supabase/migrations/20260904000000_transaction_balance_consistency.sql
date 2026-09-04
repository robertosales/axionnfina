-- Mantem o saldo exibido da conta consistente com transacoes efetivadas.
-- O saldo inicial permanece responsabilidade do cadastro/sincronizacao da conta.

CREATE OR REPLACE FUNCTION public.apply_transaction_balance_delta(
  p_account_id uuid,
  p_delta numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_account_id IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE public.accounts
  SET balance = COALESCE(balance, 0) + p_delta,
      current_balance = COALESCE(current_balance, balance) + p_delta,
      updated_at = now()
  WHERE id = p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transaction_balance_delta(
  p_account_id uuid,
  p_amount numeric,
  p_status public.transaction_status,
  p_record_origin text
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_account_id IS NULL OR p_status <> 'settled' OR p_record_origin = 'open_finance' THEN 0
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
      OLD.account_id, OLD.amount, OLD.status, OLD.record_origin
    );
    PERFORM public.apply_transaction_balance_delta(OLD.account_id, -v_previous_delta);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_next_delta := public.transaction_balance_delta(
      NEW.account_id, NEW.amount, NEW.status, NEW.record_origin
    );
    PERFORM public.apply_transaction_balance_delta(NEW.account_id, v_next_delta);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS transactions_sync_account_balance ON public.transactions;
CREATE TRIGGER transactions_sync_account_balance
AFTER INSERT OR UPDATE OF account_id, amount, status OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_account_balance();

REVOKE ALL ON FUNCTION public.apply_transaction_balance_delta(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transaction_balance_delta(uuid, numeric, public.transaction_status, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_transaction_account_balance() FROM PUBLIC;
