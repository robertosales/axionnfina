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
