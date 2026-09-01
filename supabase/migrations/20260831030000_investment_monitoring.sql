-- Axionn Finance: automacao idempotente do Radar e acompanhamento plano x carteira.

ALTER TABLE public.agent_insights
  ADD COLUMN IF NOT EXISTS insight_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_insights_user_key
  ON public.agent_insights(user_id, insight_key);

CREATE TABLE IF NOT EXISTS public.investment_alert_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  minimum_score integer NOT NULL DEFAULT 70 CHECK (minimum_score BETWEEN 0 AND 100),
  score_change_threshold integer NOT NULL DEFAULT 5 CHECK (score_change_threshold BETWEEN 1 AND 50),
  drift_threshold numeric(5,2) NOT NULL DEFAULT 10 CHECK (drift_threshold BETWEEN 1 AND 100),
  last_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investment_radar_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  market_reference_date date NOT NULL,
  top_opportunity_id text,
  top_opportunity_name text,
  top_score integer CHECK (top_score BETWEEN 0 AND 100),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, run_date)
);

CREATE TABLE IF NOT EXISTS public.investment_plan_progress_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.investment_plans(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  actual_total numeric(14,2) NOT NULL DEFAULT 0,
  overall_drift numeric(5,2) NOT NULL DEFAULT 0 CHECK (overall_drift BETWEEN 0 AND 100),
  status text NOT NULL CHECK (status IN ('aligned', 'attention', 'off_track')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, snapshot_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_alert_preferences TO authenticated;
GRANT ALL ON public.investment_alert_preferences TO service_role;
GRANT SELECT ON public.investment_radar_runs, public.investment_plan_progress_snapshots TO authenticated;
GRANT ALL ON public.investment_radar_runs, public.investment_plan_progress_snapshots TO service_role;

ALTER TABLE public.investment_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_radar_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_plan_progress_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_alert_preferences_own ON public.investment_alert_preferences;
CREATE POLICY investment_alert_preferences_own ON public.investment_alert_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS investment_radar_runs_own_read ON public.investment_radar_runs;
CREATE POLICY investment_radar_runs_own_read ON public.investment_radar_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS investment_plan_progress_own_read ON public.investment_plan_progress_snapshots;
CREATE POLICY investment_plan_progress_own_read ON public.investment_plan_progress_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_investment_radar_runs_user_date
  ON public.investment_radar_runs(user_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_investment_plan_progress_user_date
  ON public.investment_plan_progress_snapshots(user_id, snapshot_date DESC);

DROP TRIGGER IF EXISTS investment_alert_preferences_updated_at ON public.investment_alert_preferences;
CREATE TRIGGER investment_alert_preferences_updated_at
BEFORE UPDATE ON public.investment_alert_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS investment_radar_runs_updated_at ON public.investment_radar_runs;
CREATE TRIGGER investment_radar_runs_updated_at
BEFORE UPDATE ON public.investment_radar_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS investment_plan_progress_updated_at ON public.investment_plan_progress_snapshots;
CREATE TRIGGER investment_plan_progress_updated_at
BEFORE UPDATE ON public.investment_plan_progress_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.investment_radar_runs IS
  'Uma execucao idempotente do Radar por usuario e data.';
COMMENT ON TABLE public.investment_plan_progress_snapshots IS
  'Historico diario de aderencia entre planos salvos e carteira observada.';
