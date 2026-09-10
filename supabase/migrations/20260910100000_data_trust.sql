-- Provider amounts remain immutable from user edits; corrections are an overlay.
CREATE TABLE public.transaction_overrides (
  transaction_id uuid PRIMARY KEY REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  description text,
  merchant text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_overrides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_overrides TO authenticated;
CREATE POLICY transaction_overrides_owner ON public.transaction_overrides FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.edit_transaction(p_id uuid, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_transaction public.transactions;
BEGIN
  SELECT * INTO v_transaction FROM public.transactions WHERE id = p_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found or access denied'; END IF;
  IF v_transaction.record_origin IN ('open_finance', 'import') THEN
    IF (p_changes ? 'amount' AND (p_changes->>'amount')::numeric IS DISTINCT FROM v_transaction.amount)
      OR (p_changes ? 'account_id' AND NULLIF(p_changes->>'account_id', '')::uuid IS DISTINCT FROM v_transaction.account_id)
      OR (p_changes ? 'type' AND p_changes->>'type' IS DISTINCT FROM v_transaction.type::text)
      OR (p_changes ? 'occurred_at' AND (p_changes->>'occurred_at')::date IS DISTINCT FROM v_transaction.occurred_at) THEN
      RAISE EXCEPTION 'Imported financial fields cannot be changed; edit description or category instead';
    END IF;
    INSERT INTO public.transaction_overrides(transaction_id, user_id, category, description, merchant)
    VALUES (p_id, auth.uid(), p_changes->>'category', p_changes->>'description', p_changes->>'merchant')
    ON CONFLICT (transaction_id) DO UPDATE SET
      category = COALESCE(EXCLUDED.category, transaction_overrides.category),
      description = COALESCE(EXCLUDED.description, transaction_overrides.description),
      merchant = COALESCE(EXCLUDED.merchant, transaction_overrides.merchant), updated_at = now();
  ELSE
    IF p_changes ? 'account_id' AND NULLIF(p_changes->>'account_id', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.accounts WHERE id = (p_changes->>'account_id')::uuid AND user_id = auth.uid()
    ) THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;
    UPDATE public.transactions SET
      category = COALESCE(p_changes->>'category', category),
      description = COALESCE(p_changes->>'description', description),
      merchant = CASE WHEN p_changes ? 'merchant' THEN p_changes->>'merchant' ELSE merchant END,
      amount = COALESCE((p_changes->>'amount')::numeric, amount),
      type = COALESCE((p_changes->>'type')::public.transaction_type, type),
      account_id = CASE WHEN p_changes ? 'account_id' THEN NULLIF(p_changes->>'account_id', '')::uuid ELSE account_id END,
      occurred_at = COALESCE((p_changes->>'occurred_at')::date, occurred_at)
    WHERE id = p_id AND user_id = auth.uid();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.edit_transaction(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_transaction(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.preserve_imported_transaction() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.record_origin IN ('open_finance', 'import') THEN
    RAISE EXCEPTION 'Imported transactions must be archived, not deleted';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER transactions_preserve_imported BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.preserve_imported_transaction();

-- An imported bank balance already includes its transactions.
CREATE OR REPLACE FUNCTION public.transaction_balance_delta(
  p_account_id uuid, p_amount numeric, p_status public.transaction_status,
  p_record_origin text, p_archived_at timestamptz DEFAULT NULL
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_account_id IS NULL OR p_status <> 'settled'
    OR p_archived_at IS NOT NULL OR p_record_origin = 'open_finance' THEN 0
    ELSE COALESCE(p_amount, 0) END;
$$;
REVOKE ALL ON FUNCTION public.transaction_balance_delta(uuid, numeric, public.transaction_status, text, timestamptz) FROM PUBLIC;

-- NOT VALID preserves legacy records while rejecting new invalid writes.
ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_positive_amount CHECK (amount > 0 AND amount <> 'NaN'::numeric) NOT VALID;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_finite_amount CHECK (amount <> 'NaN'::numeric) NOT VALID;

CREATE TABLE public.investment_goal_links (
  position_id uuid PRIMARY KEY REFERENCES public.investment_positions(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_goal_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_goal_links TO authenticated;
CREATE POLICY investment_goal_links_owner ON public.investment_goal_links FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investment_positions p WHERE p.id = position_id AND p.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())
);
