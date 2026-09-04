CREATE OR REPLACE FUNCTION public.confirm_credit_invoice(p_invoice_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_count integer := 0;
  v_item record;
  v_transaction_id uuid;
BEGIN
  SELECT cc.account_id INTO v_account_id
  FROM public.credit_card_invoices invoice
  JOIN public.credit_cards cc ON cc.id = invoice.card_id
  WHERE invoice.id = p_invoice_id AND invoice.user_id = auth.uid();
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Invoice not found or access denied'; END IF;

  FOR v_item IN SELECT * FROM public.credit_card_invoice_items WHERE invoice_id = p_invoice_id AND user_id = auth.uid()
  LOOP
    v_transaction_id := public.upsert_transaction_idempotent(v_item.external_id, jsonb_build_object(
      'account_id', v_account_id, 'description', v_item.description, 'amount', v_item.amount,
      'type', 'expense', 'category', 'Cartão (Geral)', 'occurred_at', v_item.purchase_date
    ));
    UPDATE public.credit_card_invoice_items SET transaction_id = v_transaction_id WHERE id = v_item.id;
    v_count := v_count + 1;
  END LOOP;
  UPDATE public.credit_card_invoices SET status = 'confirmed' WHERE id = p_invoice_id;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_credit_invoice(uuid) TO authenticated;
