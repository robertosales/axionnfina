-- Instalação nova: pacote completo. Não reaplicar em banco já migrado.
BEGIN;

-- 20260910100000_data_trust.sql
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


-- 20260910110000_atomic_transaction_ledger.sql
-- Keep manual/imported transaction mutations and their journal in one transaction.
-- Opening balances are not inferred from movement history.
CREATE OR REPLACE FUNCTION public.check_transaction_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Account ownership mismatch'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Transaction owner cannot be changed';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.record_origin IN ('open_finance', 'import') AND NEW.record_origin IS DISTINCT FROM OLD.record_origin THEN
    RAISE EXCEPTION 'Imported transaction origin cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_transaction_owner() FROM PUBLIC;
CREATE TRIGGER transactions_check_owner BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.check_transaction_owner();

CREATE OR REPLACE FUNCTION public.sync_transaction_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry uuid;
  v_financial uuid;
  v_offset uuid;
  v_id uuid;
  v_user uuid;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.journal_entries SET status = 'reversed', updated_at = now()
    WHERE user_id = v_user AND reference_id = v_id AND reference_type = 'transaction'
      AND source = 'transaction_trigger' AND status = 'posted';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.account_id IS NULL OR NEW.status <> 'settled' OR NEW.archived_at IS NOT NULL
    OR NEW.record_origin = 'open_finance' OR NEW.amount = 0 THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Account ownership mismatch';
  END IF;
  SELECT id INTO v_financial FROM public.ledger_accounts
    WHERE user_id = NEW.user_id AND account_id = NEW.account_id AND is_active ORDER BY code LIMIT 1;
  SELECT id INTO v_offset FROM public.ledger_accounts
    WHERE user_id = NEW.user_id AND code = CASE WHEN NEW.type = 'transfer' THEN '3.1.1'
      WHEN NEW.amount > 0 THEN '4.1.4' ELSE '5.1.11' END AND is_active LIMIT 1;
  IF v_financial IS NULL OR v_offset IS NULL THEN RAISE EXCEPTION 'Ledger accounts missing'; END IF;
  INSERT INTO public.journal_entries(user_id, entry_date, description, reference_type, reference_id, source)
  VALUES (NEW.user_id, NEW.occurred_at, NEW.description, 'transaction', NEW.id, 'transaction_trigger') RETURNING id INTO v_entry;
  INSERT INTO public.journal_lines(journal_entry_id, ledger_account_id, entry_type, amount, currency)
  VALUES
    (v_entry, v_financial, CASE WHEN NEW.amount > 0 THEN 'debit' ELSE 'credit' END::public.ledger_entry_type, abs(NEW.amount), COALESCE(NEW.currency, 'BRL')),
    (v_entry, v_offset, CASE WHEN NEW.amount > 0 THEN 'credit' ELSE 'debit' END::public.ledger_entry_type, abs(NEW.amount), COALESCE(NEW.currency, 'BRL'));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_transaction_journal() FROM PUBLIC;
CREATE TRIGGER transactions_sync_journal AFTER INSERT OR UPDATE OF account_id, amount, status, archived_at, occurred_at, type OR DELETE
ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_journal();

CREATE VIEW public.account_reconciliation WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.user_id, a.balance AS reported_balance,
  COALESCE(SUM(CASE WHEN jl.entry_type = 'debit' THEN jl.amount ELSE -jl.amount END)
    FILTER (WHERE je.status = 'posted'), 0) AS journal_movement_balance,
  a.balance - COALESCE(SUM(CASE WHEN jl.entry_type = 'debit' THEN jl.amount ELSE -jl.amount END)
    FILTER (WHERE je.status = 'posted'), 0) AS difference_including_opening_balance
FROM public.accounts a
LEFT JOIN public.ledger_accounts la ON la.account_id = a.id AND la.user_id = a.user_id
LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.user_id = a.user_id
WHERE a.archived_at IS NULL GROUP BY a.id, a.user_id, a.balance;
GRANT SELECT ON public.account_reconciliation TO authenticated;

CREATE OR REPLACE FUNCTION public.check_journal_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.journal_lines WHERE journal_entry_id = NEW.journal_entry_id
    GROUP BY currency HAVING sum(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END) <> 0
  ) THEN RAISE EXCEPTION 'Journal must balance in each currency'; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_journal_balance() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER journal_lines_balanced AFTER INSERT OR UPDATE ON public.journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_journal_balance();


-- 20260910120000_wealth_snapshots.sql
-- Save only the observed current month; never fabricate prior history.
CREATE OR REPLACE FUNCTION public.refresh_wealth_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_total numeric; v_liquidity numeric; v_has_investment_accounts boolean;
BEGIN
  v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user) THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(balance), 0),
    COALESCE(sum(balance) FILTER (WHERE type IN ('checking', 'savings')), 0),
    COALESCE(bool_or(type = 'investment'), false)
  INTO v_total, v_liquidity, v_has_investment_accounts
  FROM public.accounts WHERE user_id = v_user AND archived_at IS NULL;
  IF NOT v_has_investment_accounts THEN
    SELECT v_total + COALESCE(sum(quantity * current_price), 0) INTO v_total
    FROM public.investment_positions WHERE user_id = v_user AND archived_at IS NULL;
  END IF;
  INSERT INTO public.net_worth_snapshots(user_id, month, net_worth, liquidity)
  VALUES (v_user, date_trunc('month', CURRENT_DATE)::date, v_total, v_liquidity)
  ON CONFLICT (user_id, month) DO UPDATE SET net_worth = EXCLUDED.net_worth, liquidity = EXCLUDED.liquidity, updated_at = now();
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_wealth_snapshot() FROM PUBLIC;
CREATE TRIGGER accounts_wealth_snapshot AFTER INSERT OR UPDATE OF balance, type, archived_at OR DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.refresh_wealth_snapshot();
CREATE TRIGGER investments_wealth_snapshot AFTER INSERT OR UPDATE OF quantity, current_price, archived_at OR DELETE ON public.investment_positions
FOR EACH ROW EXECUTE FUNCTION public.refresh_wealth_snapshot();


-- 20260910130000_ensure_transaction_ledger_accounts.sql
-- Repair the journal trigger without replaying prior migrations or changing balances.
CREATE OR REPLACE FUNCTION public.sync_transaction_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry uuid;
  v_financial uuid;
  v_offset uuid;
  v_id uuid;
  v_user uuid;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.journal_entries SET status = 'reversed', updated_at = now()
    WHERE user_id = v_user AND reference_id = v_id AND reference_type = 'transaction'
      AND source = 'transaction_trigger' AND status = 'posted';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.account_id IS NULL OR NEW.status <> 'settled' OR NEW.archived_at IS NOT NULL
    OR NEW.record_origin = 'open_finance' OR NEW.amount = 0 THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Account ownership mismatch';
  END IF;
  -- Provision missing accounts inside the same atomic transaction.
  -- Existing disabled accounts are deliberately not reactivated.
  INSERT INTO public.ledger_accounts
    (user_id, code, name, type, subtype, account_id, is_system, is_active, sort_order)
  SELECT a.user_id, 'account.' || a.id::text, a.name,
    CASE WHEN a.type = 'credit' THEN 'liability' ELSE 'asset' END,
    a.type::text, a.id, false, true, 50
  FROM public.accounts a
  WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id
    AND a.archived_at IS NULL AND NOT COALESCE(a.is_archived, false)
    AND NOT EXISTS (
      SELECT 1 FROM public.ledger_accounts la
      WHERE la.user_id = a.user_id AND la.account_id = a.id
    )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ledger_accounts
    (user_id, code, name, type, subtype, is_system, is_active, sort_order)
  VALUES
    (NEW.user_id, '3.1.1', 'Patrimônio Líquido', 'equity', 'net_worth', true, true, 200),
    (NEW.user_id, '4.1.4', 'Receitas - Outras', 'revenue', 'other', true, true, 303),
    (NEW.user_id, '5.1.11', 'Despesas - Outras', 'expense', 'other', true, true, 410)
  ON CONFLICT (user_id, code) DO NOTHING;

  SELECT id INTO v_financial FROM public.ledger_accounts
    WHERE user_id = NEW.user_id AND account_id = NEW.account_id AND is_active ORDER BY code LIMIT 1;
  SELECT id INTO v_offset FROM public.ledger_accounts
    WHERE user_id = NEW.user_id AND code = CASE WHEN NEW.type = 'transfer' THEN '3.1.1'
      WHEN NEW.amount > 0 THEN '4.1.4' ELSE '5.1.11' END AND is_active LIMIT 1;
  IF v_financial IS NULL THEN
    RAISE EXCEPTION 'Financial ledger account unavailable: check account archival, ledger activation and code mapping';
  END IF;
  IF v_offset IS NULL THEN
    RAISE EXCEPTION 'Offset ledger account unavailable: check activation of codes 3.1.1, 4.1.4 and 5.1.11';
  END IF;
  INSERT INTO public.journal_entries(user_id, entry_date, description, reference_type, reference_id, source)
  VALUES (NEW.user_id, NEW.occurred_at, NEW.description, 'transaction', NEW.id, 'transaction_trigger') RETURNING id INTO v_entry;
  INSERT INTO public.journal_lines(journal_entry_id, ledger_account_id, entry_type, amount, currency)
  VALUES
    (v_entry, v_financial, CASE WHEN NEW.amount > 0 THEN 'debit' ELSE 'credit' END::public.ledger_entry_type, abs(NEW.amount), COALESCE(NEW.currency, 'BRL')),
    (v_entry, v_offset, CASE WHEN NEW.amount > 0 THEN 'credit' ELSE 'debit' END::public.ledger_entry_type, abs(NEW.amount), COALESCE(NEW.currency, 'BRL'));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_transaction_journal() FROM PUBLIC;

COMMIT;
