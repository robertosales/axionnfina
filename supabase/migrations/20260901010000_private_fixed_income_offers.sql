-- Axionn Finance: ofertas privadas informadas pelo usuario para comparacao educacional.

CREATE TABLE IF NOT EXISTS public.private_fixed_income_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution text NOT NULL,
  conglomerate text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('cdb', 'lci', 'lca')),
  rate_type text NOT NULL CHECK (rate_type IN ('fixed', 'cdi', 'ipca')),
  rate_value numeric(8,4) NOT NULL CHECK (rate_value > 0 AND rate_value <= 500),
  reference_rate numeric(8,4) CHECK (reference_rate > -100 AND reference_rate <= 100),
  minimum_investment numeric(14,2) NOT NULL DEFAULT 0 CHECK (minimum_investment >= 0),
  maturity_date date NOT NULL,
  daily_liquidity boolean NOT NULL DEFAULT false,
  fgc_eligible boolean NOT NULL DEFAULT true,
  source_url text,
  source_checked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  record_origin text NOT NULL DEFAULT 'manual'
    CHECK (record_origin IN ('manual', 'open_finance', 'import', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rate_type = 'fixed' OR reference_rate IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_fixed_income_offers TO authenticated;
GRANT ALL ON public.private_fixed_income_offers TO service_role;

ALTER TABLE public.private_fixed_income_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS private_fixed_income_offers_own ON public.private_fixed_income_offers;
CREATE POLICY private_fixed_income_offers_own
  ON public.private_fixed_income_offers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_private_fixed_income_offers_user_lifecycle
  ON public.private_fixed_income_offers(user_id, archived_at, maturity_date);

CREATE OR REPLACE FUNCTION public.set_private_offer_lifecycle_actor()
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

CREATE OR REPLACE FUNCTION public.protect_private_offer_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND OLD.record_origin <> 'manual' THEN
    RAISE EXCEPTION 'Ofertas sincronizadas ou importadas devem ser arquivadas, nao excluidas.'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS private_fixed_income_offers_updated_at ON public.private_fixed_income_offers;
CREATE TRIGGER private_fixed_income_offers_updated_at
BEFORE UPDATE ON public.private_fixed_income_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_private_offer_lifecycle_actor ON public.private_fixed_income_offers;
CREATE TRIGGER set_private_offer_lifecycle_actor
BEFORE UPDATE OF archived_at ON public.private_fixed_income_offers
FOR EACH ROW EXECUTE FUNCTION public.set_private_offer_lifecycle_actor();

DROP TRIGGER IF EXISTS protect_private_offer_deletion ON public.private_fixed_income_offers;
CREATE TRIGGER protect_private_offer_deletion
BEFORE DELETE ON public.private_fixed_income_offers
FOR EACH ROW EXECUTE FUNCTION public.protect_private_offer_deletion();

COMMENT ON TABLE public.private_fixed_income_offers IS
  'Ofertas informadas pelo usuario para comparacao educacional; taxas precisam ser confirmadas na origem.';
