-- Caminho atomico para lancamentos manuais: a conta e validada pelo mesmo usuario.
CREATE OR REPLACE FUNCTION public.create_manual_transaction(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_account_id uuid;
  v_amount numeric;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_account_id := NULLIF(p_data->>'account_id', '')::uuid;
  v_amount := (p_data->>'amount')::numeric;

  IF v_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = v_account_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;
  IF v_amount IS NULL OR v_amount = 0 THEN RAISE EXCEPTION 'Transaction amount must not be zero'; END IF;

  INSERT INTO public.transactions (
    user_id, account_id, description, amount, type, category, merchant,
    occurred_at, posted_at, status, record_origin
  ) VALUES (
    v_user_id, v_account_id, COALESCE(p_data->>'description', 'Transação'), v_amount,
    COALESCE(p_data->>'type', CASE WHEN v_amount > 0 THEN 'income' ELSE 'expense' END)::public.transaction_type,
    COALESCE(p_data->>'category', 'Outros'), p_data->>'merchant',
    COALESCE((p_data->>'occurred_at')::date, CURRENT_DATE),
    COALESCE((p_data->>'occurred_at')::timestamptz, CURRENT_DATE::timestamptz),
    'settled', 'manual'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_manual_transaction(jsonb) TO authenticated;
