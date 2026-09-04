-- Transacoes idempotentes vindas de extrato devem preservar a origem da importacao.
CREATE OR REPLACE FUNCTION public.upsert_transaction_idempotent(p_idempotency_key text, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.transactions
  WHERE user_id = auth.uid() AND external_id = p_idempotency_key;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.transactions (
    user_id, account_id, description, amount, type, category, merchant, method,
    occurred_at, external_id, record_origin, status, posted_at
  ) VALUES (
    auth.uid(),
    NULLIF(p_data->>'account_id','')::uuid,
    COALESCE(p_data->>'description','Transação'),
    COALESCE((p_data->>'amount')::numeric, 0),
    COALESCE(p_data->>'type','expense')::public.transaction_type,
    COALESCE(p_data->>'category','Outros'),
    p_data->>'merchant',
    'statement_import',
    COALESCE((p_data->>'occurred_at')::date, CURRENT_DATE),
    p_idempotency_key,
    'import',
    'settled',
    COALESCE((p_data->>'occurred_at')::timestamptz, CURRENT_DATE::timestamptz)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_transaction_idempotent(text, jsonb) TO authenticated;
