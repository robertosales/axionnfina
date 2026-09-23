REVOKE ALL ON FUNCTION public.capture_account_balance_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_account_balance_snapshot() TO service_role;