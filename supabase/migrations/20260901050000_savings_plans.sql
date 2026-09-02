-- Axionn Finance: oportunidades de economia e acompanhamento mensal.

CREATE TABLE IF NOT EXISTS public.savings_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription', 'recurring', 'category_increase', 'unusual_expense')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  merchant text,
  baseline_monthly numeric(14,2) NOT NULL DEFAULT 0 CHECK (baseline_monthly >= 0),
  observed_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (observed_amount >= 0),
  target_monthly numeric(14,2) NOT NULL DEFAULT 0 CHECK (target_monthly >= 0),
  expected_monthly_saving numeric(14,2) NOT NULL DEFAULT 0 CHECK (expected_monthly_saving >= 0),
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'accepted', 'tracking', 'completed', 'dismissed')),
  detected_on date NOT NULL DEFAULT CURRENT_DATE,
  accepted_at timestamptz,
  tracking_started_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_key)
);

CREATE INDEX IF NOT EXISTS idx_savings_plans_user_status
  ON public.savings_plans(user_id, status, updated_at DESC);

ALTER TABLE public.savings_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.savings_plans TO authenticated;
GRANT ALL ON public.savings_plans TO service_role;

DROP POLICY IF EXISTS "savings_plans_select_own" ON public.savings_plans;
CREATE POLICY "savings_plans_select_own" ON public.savings_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "savings_plans_insert_own" ON public.savings_plans;
CREATE POLICY "savings_plans_insert_own" ON public.savings_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "savings_plans_update_own" ON public.savings_plans;
CREATE POLICY "savings_plans_update_own" ON public.savings_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS savings_plans_updated_at ON public.savings_plans;
CREATE TRIGGER savings_plans_updated_at
  BEFORE UPDATE ON public.savings_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.saving_plan_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.savings_plans(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  baseline_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (baseline_amount >= 0),
  actual_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (actual_amount >= 0),
  realized_saving numeric(14,2) NOT NULL DEFAULT 0 CHECK (realized_saving >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_saving_plan_checkins_user_month
  ON public.saving_plan_checkins(user_id, reference_month DESC);

ALTER TABLE public.saving_plan_checkins ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.saving_plan_checkins TO authenticated;
GRANT ALL ON public.saving_plan_checkins TO service_role;

DROP POLICY IF EXISTS "saving_plan_checkins_select_own" ON public.saving_plan_checkins;
CREATE POLICY "saving_plan_checkins_select_own" ON public.saving_plan_checkins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saving_plan_checkins_insert_own" ON public.saving_plan_checkins;
CREATE POLICY "saving_plan_checkins_insert_own" ON public.saving_plan_checkins
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.savings_plans
      WHERE id = plan_id AND user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "saving_plan_checkins_update_own" ON public.saving_plan_checkins;
CREATE POLICY "saving_plan_checkins_update_own" ON public.saving_plan_checkins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.savings_plans
      WHERE id = plan_id AND user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS saving_plan_checkins_updated_at ON public.saving_plan_checkins;
CREATE TRIGGER saving_plan_checkins_updated_at
  BEFORE UPDATE ON public.saving_plan_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
