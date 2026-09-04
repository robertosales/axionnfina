CREATE OR REPLACE FUNCTION public.create_credit_invoice_review(
  p_card_id uuid,
  p_reference_month date,
  p_due_date date,
  p_file_name text,
  p_file_type text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_card_user_id uuid;
  v_item jsonb;
BEGIN
  SELECT user_id INTO v_card_user_id FROM public.credit_cards
  WHERE id = p_card_id AND user_id = auth.uid();
  IF v_card_user_id IS NULL THEN RAISE EXCEPTION 'Card not found or access denied'; END IF;

  INSERT INTO public.credit_card_invoices (user_id, card_id, reference_month, due_date, file_name, file_type, status, total_amount)
  VALUES (auth.uid(), p_card_id, p_reference_month, p_due_date, p_file_name, p_file_type, 'review', 0)
  ON CONFLICT (user_id, card_id, reference_month) DO UPDATE SET
    due_date = EXCLUDED.due_date, file_name = EXCLUDED.file_name, file_type = EXCLUDED.file_type,
    status = 'review', total_amount = 0
  RETURNING id INTO v_invoice_id;

  DELETE FROM public.credit_card_invoice_items WHERE invoice_id = v_invoice_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.credit_card_invoice_items (invoice_id, user_id, purchase_date, description, amount, installment, external_id)
    VALUES (v_invoice_id, auth.uid(), (v_item->>'date')::date, v_item->>'description', (v_item->>'amount')::numeric, v_item->>'installment', v_item->>'external_id')
    ON CONFLICT (user_id, external_id) DO NOTHING;
  END LOOP;

  UPDATE public.credit_card_invoices SET total_amount = COALESCE((SELECT SUM(amount) FROM public.credit_card_invoice_items WHERE invoice_id = v_invoice_id), 0)
  WHERE id = v_invoice_id;
  RETURN v_invoice_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_credit_invoice_review(uuid, date, date, text, text, jsonb) TO authenticated;
