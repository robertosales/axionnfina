-- Axionn Finance: preferencias necessarias para personalizar o Radar de Investimentos.
-- O perfil representa adequacao educacional e nao substitui o suitability da instituicao.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS risk_profile text NOT NULL DEFAULT 'conservative',
  ADD COLUMN IF NOT EXISTS investment_horizon_months integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS liquidity_preference text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS investment_objective text NOT NULL DEFAULT 'reserve';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_risk_profile_check,
  ADD CONSTRAINT profiles_risk_profile_check
    CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
  DROP CONSTRAINT IF EXISTS profiles_investment_horizon_check,
  ADD CONSTRAINT profiles_investment_horizon_check
    CHECK (investment_horizon_months BETWEEN 1 AND 600),
  DROP CONSTRAINT IF EXISTS profiles_liquidity_preference_check,
  ADD CONSTRAINT profiles_liquidity_preference_check
    CHECK (liquidity_preference IN ('daily', 'up_to_1_year', 'long_term')),
  DROP CONSTRAINT IF EXISTS profiles_investment_objective_check,
  ADD CONSTRAINT profiles_investment_objective_check
    CHECK (investment_objective IN ('reserve', 'growth', 'retirement', 'education'));

COMMENT ON COLUMN public.profiles.risk_profile IS
  'Preferencia declarada no Axionn; nao equivale ao suitability regulatorio da corretora.';
COMMENT ON COLUMN public.profiles.investment_horizon_months IS
  'Prazo de referencia usado pelo ranking educacional do Radar.';
