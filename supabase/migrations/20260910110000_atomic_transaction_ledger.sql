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
