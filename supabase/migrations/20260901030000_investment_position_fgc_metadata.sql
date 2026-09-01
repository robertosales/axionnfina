-- Axionn Finance: metadados para consolidar exposicao FGC por conglomerado.

ALTER TABLE public.investment_positions
  ADD COLUMN IF NOT EXISTS private_product_type text
    CHECK (private_product_type IS NULL OR private_product_type IN ('cdb', 'lci', 'lca')),
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS conglomerate text,
  ADD COLUMN IF NOT EXISTS maturity_date date,
  ADD COLUMN IF NOT EXISTS fgc_eligible boolean;

CREATE INDEX IF NOT EXISTS idx_investment_positions_user_conglomerate
  ON public.investment_positions(user_id, conglomerate)
  WHERE archived_at IS NULL AND fgc_eligible = true;

COMMENT ON COLUMN public.investment_positions.conglomerate IS
  'Conglomerado informado pelo usuario para consolidacao educacional da cobertura FGC.';
