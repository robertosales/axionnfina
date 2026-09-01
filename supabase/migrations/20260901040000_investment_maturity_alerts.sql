-- Axionn Finance: antecedencia configuravel para alertas de vencimento.

ALTER TABLE public.investment_alert_preferences
  ADD COLUMN IF NOT EXISTS maturity_alert_days integer NOT NULL DEFAULT 30
    CHECK (maturity_alert_days BETWEEN 1 AND 365);

COMMENT ON COLUMN public.investment_alert_preferences.maturity_alert_days IS
  'Antecedencia em dias para alertas de vencimento de posicoes de renda fixa.';
