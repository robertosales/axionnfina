-- Run after the 20260910 migrations, including 20260910130000, in an isolated test branch.
-- Fixtures and changes are rolled back. Any exception means the test failed.
BEGIN;
DO $$
DECLARE u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.user1', u1::text, true);
  PERFORM set_config('test.user2', u2::text, true);
  PERFORM set_config('test.account1', a1::text, true);
  PERFORM set_config('test.account2', a2::text, true);
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (u1, u1::text || '@example.test', '{}'::jsonb), (u2, u2::text || '@example.test', '{}'::jsonb);
  INSERT INTO public.accounts(id, user_id, name, institution, type, balance, current_balance)
    VALUES (a1, u1, 'Fixture A', 'Fixture', 'checking', 1000, 1000),
           (a2, u2, 'Fixture B', 'Fixture', 'checking', 2000, 2000);
  -- Regression: journal creation must work even when legacy bootstrap did not run.
  DELETE FROM public.ledger_accounts
  WHERE user_id = u1 AND (account_id = a1 OR code IN ('3.1.1', '4.1.4', '5.1.11'));
END;
$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.user1'), true);
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user1'), 'role', 'authenticated')::text, true);
DO $$
DECLARE t uuid; n integer; balance_value numeric; movement numeric; goal1 uuid; position1 uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.accounts WHERE id = current_setting('test.account2')::uuid) THEN RAISE EXCEPTION 'FAIL: RLS read leaked user2 account'; END IF;
  UPDATE public.accounts SET balance = 1 WHERE id = current_setting('test.account2')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: RLS write leaked user2 account'; END IF;
  BEGIN
    PERFORM public.create_manual_transaction(jsonb_build_object('account_id', current_setting('test.account2'), 'amount', -10, 'type', 'expense'));
    RAISE EXCEPTION 'FAIL: IDOR accepted foreign account';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  t := public.create_manual_transaction(jsonb_build_object('account_id', current_setting('test.account1'), 'amount', -100, 'type', 'expense', 'description', 'Fixture expense'));
  SELECT balance INTO balance_value FROM public.accounts WHERE id = current_setting('test.account1')::uuid;
  IF balance_value <> 900 THEN RAISE EXCEPTION 'FAIL: insert balance %', balance_value; END IF;
  PERFORM public.edit_transaction(t, '{"amount":-120}'::jsonb);
  SELECT balance INTO balance_value FROM public.accounts WHERE id = current_setting('test.account1')::uuid;
  IF balance_value <> 880 THEN RAISE EXCEPTION 'FAIL: update balance %', balance_value; END IF;
  SELECT journal_movement_balance INTO movement FROM public.account_reconciliation WHERE account_id = current_setting('test.account1')::uuid;
  IF movement <> -120 THEN RAISE EXCEPTION 'FAIL: journal reconciliation %', movement; END IF;
  UPDATE public.transactions SET archived_at = now() WHERE id = t;
  SELECT balance INTO balance_value FROM public.accounts WHERE id = current_setting('test.account1')::uuid;
  IF balance_value <> 1000 THEN RAISE EXCEPTION 'FAIL: reversal balance %', balance_value; END IF;
  SELECT journal_movement_balance INTO movement FROM public.account_reconciliation WHERE account_id = current_setting('test.account1')::uuid;
  IF movement <> 0 THEN RAISE EXCEPTION 'FAIL: reversal journal %', movement; END IF;

  INSERT INTO public.transactions(user_id, account_id, description, category, amount, type, status, occurred_at, record_origin)
  VALUES (current_setting('test.user1')::uuid, current_setting('test.account1')::uuid, 'Provider description', 'Original', -50, 'expense', 'settled', CURRENT_DATE, 'open_finance') RETURNING id INTO t;
  PERFORM public.edit_transaction(t, '{"category":"Corrected","description":"My description"}'::jsonb);
  UPDATE public.transactions SET description = 'Provider refreshed' WHERE id = t;
  IF NOT EXISTS (SELECT 1 FROM public.transaction_overrides WHERE transaction_id = t AND category = 'Corrected' AND description = 'My description') THEN RAISE EXCEPTION 'FAIL: override lost'; END IF;
  SELECT balance INTO balance_value FROM public.accounts WHERE id = current_setting('test.account1')::uuid;
  IF balance_value <> 1000 THEN RAISE EXCEPTION 'FAIL: provider balance double counted'; END IF;
  BEGIN
    DELETE FROM public.transactions WHERE id = t;
    RAISE EXCEPTION 'FAIL: imported transaction deleted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.edit_transaction(t, '{"amount":-999}'::jsonb);
    RAISE EXCEPTION 'FAIL: imported amount changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  PERFORM set_config('test.transaction1', t::text, true);
  INSERT INTO public.goals(user_id, title, target_amount, current_amount) VALUES (auth.uid(), 'Fixture goal', 1000, 0) RETURNING id INTO goal1;
  INSERT INTO public.investment_positions(user_id, ticker, name, quantity, average_price, current_price)
    VALUES (auth.uid(), 'FIXTURE', 'Fixture position', 1, 100, 110) RETURNING id INTO position1;
  INSERT INTO public.investment_goal_links(user_id, goal_id, position_id) VALUES (auth.uid(), goal1, position1);
  PERFORM set_config('test.goal1', goal1::text, true);
  PERFORM set_config('test.position1', position1::text, true);
END;
$$;
SELECT set_config('request.jwt.claim.sub', current_setting('test.user2'), true);
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user2'), 'role', 'authenticated')::text, true);
DO $$ DECLARE position2 uuid; BEGIN
  IF EXISTS (SELECT 1 FROM public.investment_goal_links WHERE position_id = current_setting('test.position1')::uuid) THEN RAISE EXCEPTION 'FAIL: investment goal RLS'; END IF;
  BEGIN
    INSERT INTO public.investment_positions(user_id, ticker, name) VALUES (auth.uid(), 'FIXTURE2', 'Second fixture') RETURNING id INTO position2;
    INSERT INTO public.investment_goal_links(user_id, goal_id, position_id)
      VALUES (auth.uid(), current_setting('test.goal1')::uuid, position2);
    RAISE EXCEPTION 'FAIL: cross-user investment link';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  IF EXISTS (SELECT 1 FROM public.transaction_overrides WHERE transaction_id = current_setting('test.transaction1')::uuid) THEN RAISE EXCEPTION 'FAIL: override RLS'; END IF;
  BEGIN
    PERFORM public.edit_transaction(current_setting('test.transaction1')::uuid, '{"category":"Foreign edit"}'::jsonb);
    RAISE EXCEPTION 'FAIL: cross-user edit';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
END; $$;
SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: RLS, IDOR, balances, journal reversal, imported overrides' AS result;
