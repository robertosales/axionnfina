-- Axionn Finance: origem idempotente, importacoes revisaveis e movimentacoes da carteira.

ALTER TABLE public.investment_positions
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'open_finance', 'csv', 'pdf')),
  ADD COLUMN IF NOT EXISTS source_connection_id uuid REFERENCES public.account_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_file_name text,
  ADD COLUMN IF NOT EXISTS reference_date date,
  ADD COLUMN IF NOT EXISTS provider_balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

UPDATE public.investment_positions
SET source = CASE
  WHEN record_origin = 'open_finance' THEN 'open_finance'
  WHEN record_origin = 'import' THEN 'csv'
  ELSE 'manual'
END;

ALTER TABLE public.investment_positions
  DROP CONSTRAINT IF EXISTS investment_positions_user_source_external_key;
ALTER TABLE public.investment_positions
  ADD CONSTRAINT investment_positions_user_source_external_key
  UNIQUE (user_id, source, external_id);

CREATE INDEX IF NOT EXISTS idx_investment_positions_connection
  ON public.investment_positions(user_id, source_connection_id)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.investment_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv', 'pdf')),
  status text NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'completed', 'failed')),
  rows_found integer NOT NULL DEFAULT 0 CHECK (rows_found >= 0),
  rows_imported integer NOT NULL DEFAULT 0 CHECK (rows_imported >= 0),
  rows_rejected integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.investment_import_batches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.investment_import_batches TO authenticated;
GRANT ALL ON public.investment_import_batches TO service_role;
CREATE POLICY "investment_import_batches_own" ON public.investment_import_batches
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.investment_positions(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('open_finance', 'csv', 'pdf')),
  type text NOT NULL CHECK (type IN ('buy', 'sell', 'tax', 'transfer', 'interest', 'amortization', 'other')),
  description text,
  quantity numeric(18,6) NOT NULL DEFAULT 0,
  unit_price numeric(14,6) NOT NULL DEFAULT 0,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2),
  fees numeric(14,2) NOT NULL DEFAULT 0,
  occurred_at date NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_position_date
  ON public.investment_transactions(position_id, occurred_at DESC);

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.investment_transactions TO authenticated;
GRANT ALL ON public.investment_transactions TO service_role;
CREATE POLICY "investment_transactions_own" ON public.investment_transactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS investment_transactions_updated_at ON public.investment_transactions;
CREATE TRIGGER investment_transactions_updated_at
  BEFORE UPDATE ON public.investment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
