CREATE POLICY openfinance_tokens_own ON public.openfinance_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.openfinance_tokens TO authenticated;
GRANT ALL ON public.openfinance_tokens TO service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role, anon;
ALTER EXTENSION vector SET SCHEMA extensions;