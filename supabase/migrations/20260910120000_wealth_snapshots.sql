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
