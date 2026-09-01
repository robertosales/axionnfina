-- Axionn Finance: preferencias e historico do monitoramento de ofertas privadas.

ALTER TABLE public.investment_alert_preferences
  ADD COLUMN IF NOT EXISTS private_comparison_amount numeric(14,2) NOT NULL DEFAULT 10000
    CHECK (private_comparison_amount > 0),
  ADD COLUMN IF NOT EXISTS private_offer_max_age_days integer NOT NULL DEFAULT 7
    CHECK (private_offer_max_age_days BETWEEN 1 AND 90);

ALTER TABLE public.investment_radar_runs
  ADD COLUMN IF NOT EXISTS private_top_offer_id uuid
    REFERENCES public.private_fixed_income_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS private_top_offer_name text,
  ADD COLUMN IF NOT EXISTS private_top_score integer CHECK (private_top_score BETWEEN 0 AND 100);

COMMENT ON COLUMN public.investment_alert_preferences.private_offer_max_age_days IS
  'Idade maxima da conferencia manual para uma oferta privada gerar insight.';
