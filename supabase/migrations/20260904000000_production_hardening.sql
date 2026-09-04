-- FASE 6: limite distribuído de custo para o agente de IA.

CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_daily_usage FROM anon, authenticated;
GRANT SELECT ON public.ai_daily_usage TO authenticated;
GRANT ALL ON public.ai_daily_usage TO service_role;

DROP POLICY IF EXISTS "ai_daily_usage_select_own" ON public.ai_daily_usage;
CREATE POLICY "ai_daily_usage_select_own" ON public.ai_daily_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_daily_ai_quota(p_daily_limit integer DEFAULT 100)
RETURNS TABLE(allowed boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_daily_limit < 1 OR p_daily_limit > 1000 THEN
    RAISE EXCEPTION 'daily limit must be between 1 and 1000';
  END IF;

  INSERT INTO public.ai_daily_usage (user_id, usage_date, request_count, updated_at)
  VALUES (v_user_id, CURRENT_DATE, 1, now())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET request_count = public.ai_daily_usage.request_count + 1,
        updated_at = now()
    WHERE public.ai_daily_usage.request_count < p_daily_limit
  RETURNING request_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT request_count INTO v_count
      FROM public.ai_daily_usage
      WHERE user_id = v_user_id AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, GREATEST(0, p_daily_limit - v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_ai_quota(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_daily_ai_quota(integer) TO authenticated;
