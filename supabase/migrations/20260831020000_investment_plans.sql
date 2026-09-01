-- Axionn Finance: planos de aporte simulados a partir do Radar.

CREATE TABLE IF NOT EXISTS public.investment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  initial_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (initial_amount >= 0),
  monthly_contribution numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_contribution >= 0),
  horizon_months integer NOT NULL CHECK (horizon_months BETWEEN 1 AND 600),
  market_reference_date date NOT NULL,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  record_origin text NOT NULL DEFAULT 'manual'
    CHECK (record_origin IN ('manual', 'open_finance', 'import', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_plans TO authenticated;
GRANT ALL ON public.investment_plans TO service_role;

ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investment_plans_own ON public.investment_plans;
CREATE POLICY investment_plans_own
  ON public.investment_plans
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_investment_plans_user_archived
  ON public.investment_plans(user_id, archived_at, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_investment_plan_lifecycle_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    NEW.archived_by := CASE WHEN NEW.archived_at IS NULL THEN NULL ELSE auth.uid() END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_investment_plan_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND OLD.record_origin <> 'manual' THEN
    RAISE EXCEPTION 'Planos sincronizados ou gerados pelo sistema devem ser arquivados, nao excluidos.'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS investment_plans_updated_at ON public.investment_plans;
CREATE TRIGGER investment_plans_updated_at
BEFORE UPDATE ON public.investment_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_investment_plans_lifecycle_actor ON public.investment_plans;
CREATE TRIGGER set_investment_plans_lifecycle_actor
BEFORE UPDATE OF archived_at ON public.investment_plans
FOR EACH ROW EXECUTE FUNCTION public.set_investment_plan_lifecycle_actor();

DROP TRIGGER IF EXISTS protect_investment_plans_deletion ON public.investment_plans;
CREATE TRIGGER protect_investment_plans_deletion
BEFORE DELETE ON public.investment_plans
FOR EACH ROW EXECUTE FUNCTION public.protect_investment_plan_deletion();

DROP TRIGGER IF EXISTS audit_investment_plans ON public.investment_plans;
CREATE TRIGGER audit_investment_plans
AFTER INSERT OR UPDATE OR DELETE ON public.investment_plans
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

COMMENT ON TABLE public.investment_plans IS
  'Simulacoes educacionais salvas pelo usuario; nao representam ordem ou recomendacao regulada.';
