-- Axionn Finance: avaliacao educacional e auditavel do primeiro investimento.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS investment_knowledge text
    CHECK (investment_knowledge IN ('none', 'basic', 'experienced')),
  ADD COLUMN IF NOT EXISTS fluctuation_tolerance text
    CHECK (fluctuation_tolerance IN ('avoid', 'some', 'high')),
  ADD COLUMN IF NOT EXISTS investment_guidance_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.investment_guidance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective text NOT NULL CHECK (objective IN ('reserve', 'growth', 'retirement', 'education')),
  horizon_months integer NOT NULL CHECK (horizon_months BETWEEN 1 AND 600),
  liquidity_preference text NOT NULL CHECK (liquidity_preference IN ('daily', 'up_to_1_year', 'long_term')),
  fluctuation_tolerance text NOT NULL CHECK (fluctuation_tolerance IN ('avoid', 'some', 'high')),
  knowledge_level text NOT NULL CHECK (knowledge_level IN ('none', 'basic', 'experienced')),
  derived_risk_profile text NOT NULL CHECK (derived_risk_profile IN ('conservative', 'moderate', 'aggressive')),
  readiness text NOT NULL CHECK (readiness IN ('organize', 'protect', 'ready')),
  financial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  educational_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_guidance_user_created
  ON public.investment_guidance_assessments(user_id, created_at DESC);

ALTER TABLE public.investment_guidance_assessments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.investment_guidance_assessments TO authenticated;
GRANT ALL ON public.investment_guidance_assessments TO service_role;

DROP POLICY IF EXISTS "investment_guidance_select_own" ON public.investment_guidance_assessments;
CREATE POLICY "investment_guidance_select_own" ON public.investment_guidance_assessments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "investment_guidance_insert_own" ON public.investment_guidance_assessments;
CREATE POLICY "investment_guidance_insert_own" ON public.investment_guidance_assessments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
