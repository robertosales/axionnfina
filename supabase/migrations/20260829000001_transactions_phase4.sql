-- ============================================================
-- FASE 4: Motor de Transações — Pipeline Completo + Ledger
-- ============================================================
-- Schema atualizado: transaction_categories já evoluída pela migration 20260829000000
-- transaction_categories columns: id, code, label, name, parent_code, kind, parent_id, icon, color, is_system, sort_order, created_at, updated_at

-- =============== TYPES ===============
CREATE TYPE public.categorization_source AS ENUM (
  'mcc', 'rule', 'user', 'ml', 'llm', 'manual'
);
CREATE TYPE public.transaction_status AS ENUM (
  'pending', 'settled', 'cancelled', 'failed', 'reversed'
);
CREATE TYPE public.ledger_entry_type AS ENUM ('debit', 'credit');

-- =============== EXTERNAL TRANSACTIONS (raw from provider) ===============
CREATE TABLE public.external_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  external_account_id text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  description text NOT NULL,
  merchant_name text,
  mcc text,
  posted_at timestamptz NOT NULL,
  authorized_at timestamptz,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  raw_data jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_account_id, external_id)
);

GRANT SELECT, INSERT ON public.external_transactions TO authenticated;
GRANT ALL ON public.external_transactions TO service_role;
ALTER TABLE public.external_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_transactions_own ON public.external_transactions
  FOR ALL TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.account_connections WHERE user_id = auth.uid()
  ));
CREATE INDEX idx_external_transactions_account ON public.external_transactions(account_id, posted_at DESC);
CREATE INDEX idx_external_transactions_connection ON public.external_transactions(connection_id, posted_at DESC);
CREATE INDEX idx_external_transactions_posted ON public.external_transactions(posted_at DESC);
CREATE INDEX idx_external_transactions_processed ON public.external_transactions(processed_at) WHERE processed_at IS NULL;

-- =============== TRANSACTION ENRICHMENTS (categorization audit trail) ===============
CREATE TABLE public.transaction_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 0,
  source public.categorization_source NOT NULL,
  model_version text,
  reason text,
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.transaction_enrichments TO authenticated;
GRANT ALL ON public.transaction_enrichments TO service_role;
ALTER TABLE public.transaction_enrichments ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_enrichments_own ON public.transaction_enrichments
  FOR ALL TO authenticated
  USING (transaction_id IN (
    SELECT id FROM public.transactions WHERE user_id = auth.uid()
  ));
CREATE INDEX idx_transaction_enrichments_tx ON public.transaction_enrichments(transaction_id, created_at DESC);

-- =============== TRANSACTION TAGS (user-defined) ===============
CREATE TABLE public.transaction_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_tags TO authenticated;
GRANT ALL ON public.transaction_tags TO service_role;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_tags_own ON public.transaction_tags
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== TRANSACTION PAIRS (transfers between own accounts) ===============
CREATE TABLE public.transaction_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debit_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  credit_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  matched_at timestamptz NOT NULL DEFAULT now(),
  confidence numeric(3,2) NOT NULL DEFAULT 1.0,
  is_manual boolean NOT NULL DEFAULT false,
  UNIQUE (debit_transaction_id, credit_transaction_id)
);

GRANT SELECT, INSERT, UPDATE ON public.transaction_pairs TO authenticated;
GRANT ALL ON public.transaction_pairs TO service_role;
ALTER TABLE public.transaction_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_pairs_own ON public.transaction_pairs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_transaction_pairs_user ON public.transaction_pairs(user_id, matched_at DESC);

-- =============== LEDGER ACCOUNTS (chart of accounts) ===============
CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  subtype text,
  parent_id uuid REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_accounts TO authenticated;
GRANT ALL ON public.ledger_accounts TO service_role;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_accounts_own ON public.ledger_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ledger_accounts_user ON public.ledger_accounts(user_id, type, code);

-- =============== JOURNAL ENTRIES ===============
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  description text NOT NULL,
  reference_type text,
  reference_id uuid,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'posted',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_entries_own ON public.journal_entries
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date DESC);
CREATE INDEX idx_journal_entries_reference ON public.journal_entries(reference_type, reference_id);

-- =============== JOURNAL LINES ===============
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  ledger_account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  entry_type public.ledger_entry_type NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  description text,
  sort_order int NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_lines_own ON public.journal_lines
  FOR ALL TO authenticated
  USING (journal_entry_id IN (
    SELECT id FROM public.journal_entries WHERE user_id = auth.uid()
  ));
CREATE INDEX idx_journal_lines_entry ON public.journal_lines(journal_entry_id, sort_order);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(ledger_account_id);

-- =============== ALTER EXISTING transactions TABLE ===============
-- Add new columns to existing transactions table
DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS external_transaction_id uuid REFERENCES public.external_transactions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'external_transaction_id already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'currency already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS merchant_name text;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'merchant_name already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'category_id already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'subcategory_id already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status public.transaction_status NOT NULL DEFAULT 'settled';
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'status already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS posted_at timestamptz;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'posted_at already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS authorized_at timestamptz;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'authorized_at already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'is_recurring already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'is_transfer already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_pair_id uuid;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'transfer_pair_id already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'metadata already exists'; END $$;

-- Update existing transactions with default status and posted_at
UPDATE public.transactions
SET status = 'settled',
    posted_at = occurred_at::timestamptz,
    category_id = (
      SELECT id FROM public.transaction_categories tc
      WHERE tc.code = CASE transactions.category
        WHEN 'INCOME' THEN 'INCOME'
        WHEN 'FIXED' THEN 'FIXED'
        WHEN 'VARIABLE' THEN 'VARIABLE'
        WHEN 'INVESTMENT' THEN 'INVESTMENT'
        WHEN 'TAX' THEN 'TAX'
        WHEN 'TRANSFER' THEN 'TRANSFER'
        WHEN 'HOUSING' THEN 'HOUSING'
        WHEN 'GROCERIES' THEN 'GROCERIES'
        WHEN 'DINING_OUT' THEN 'DINING_OUT'
        WHEN 'TRANSPORT' THEN 'TRANSPORT'
        WHEN 'SHOPPING_ONLINE' THEN 'SHOPPING_ONLINE'
        WHEN 'ENTERTAINMENT' THEN 'ENTERTAINMENT'
        WHEN 'STOCKS' THEN 'STOCKS'
        WHEN 'FIIS' THEN 'FIIS'
        WHEN 'FIXED_INCOME' THEN 'FIXED_INCOME'
        WHEN 'IRPF' THEN 'IRPF'
        WHEN 'DARF' THEN 'DARF'
        WHEN 'TRANSFER_IN' THEN 'TRANSFER_IN'
        WHEN 'TRANSFER_OUT' THEN 'TRANSFER_OUT'
        ELSE 'other_unclassified'
      END
    )
WHERE category_id IS NULL;

-- Trigger transactions_updated_at already exists from migration 20260825124059

CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer ON public.transactions(transfer_pair_id) WHERE is_transfer = true;
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON public.transactions(user_id, is_recurring) WHERE is_recurring = true;

-- =============== ALTER EXISTING accounts TABLE ===============
DO $$ BEGIN
  ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS current_balance numeric(14,2);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'current_balance already exists'; END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS available_balance numeric(14,2);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'available_balance already exists'; END $$;

-- =============== USER CATEGORIZATION RULES ===============
CREATE TABLE public.user_categorization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  pattern text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  priority int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_categorization_rules TO authenticated;
GRANT ALL ON public.user_categorization_rules TO service_role;
ALTER TABLE public.user_categorization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_categorization_rules_own ON public.user_categorization_rules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_categorization_rules_updated_at BEFORE UPDATE ON public.user_categorization_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_user_categorization_rules_user ON public.user_categorization_rules(user_id, priority DESC);

-- =============== DEFAULT LEDGER ACCOUNTS (seed data) ===============
INSERT INTO public.ledger_accounts (user_id, code, name, type, subtype, is_system, sort_order)
SELECT auth.uid(), code, name, type, subtype, true, sort_order
FROM (VALUES
  -- Ativos
  ('1.1.1', 'Caixa e Equivalentes', 'asset', 'cash', 10),
  ('1.1.2', 'Contas Correntes', 'asset', 'checking', 11),
  ('1.1.3', 'Poupança', 'asset', 'savings', 12),
  ('1.1.4', 'Contas de Pagamento', 'asset', 'payment', 13),
  ('1.2.1', 'Investimentos - Renda Fixa', 'asset', 'fixed_income', 20),
  ('1.2.2', 'Investimentos - Renda Variável', 'asset', 'variable_income', 21),
  ('1.2.3', 'Investimentos - Fundos', 'asset', 'funds', 22),
  ('1.2.4', 'Investimentos - Exterior', 'asset', 'international', 23),
  ('1.2.5', 'Investimentos - Cripto', 'asset', 'crypto', 24),
  ('1.3.1', 'Cartões de Crédito (Limite)', 'asset', 'credit_limit', 30),
  -- Passivos
  ('2.1.1', 'Cartões de Crédito (Fatura)', 'liability', 'credit_card', 100),
  ('2.1.2', 'Empréstimos', 'liability', 'loans', 101),
  ('2.1.3', 'Financiamentos', 'liability', 'financing', 102),
  -- Patrimônio
  ('3.1.1', 'Patrimônio Líquido', 'equity', 'net_worth', 200),
  -- Receitas
  ('4.1.1', 'Receitas - Salário', 'revenue', 'salary', 300),
  ('4.1.2', 'Receitas - Freelance', 'revenue', 'freelance', 301),
  ('4.1.3', 'Receitas - Investimentos', 'revenue', 'investment_income', 302),
  ('4.1.4', 'Receitas - Outras', 'revenue', 'other', 303),
  -- Despesas
  ('5.1.1', 'Despesas - Moradia', 'expense', 'housing', 400),
  ('5.1.2', 'Despesas - Alimentação', 'expense', 'food', 401),
  ('5.1.3', 'Despesas - Transporte', 'expense', 'transport', 402),
  ('5.1.4', 'Despesas - Saúde', 'expense', 'health', 403),
  ('5.1.5', 'Despesas - Educação', 'expense', 'education', 404),
  ('5.1.6', 'Despesas - Lazer', 'expense', 'leisure', 405),
  ('5.1.7', 'Despesas - Assinaturas', 'expense', 'subscriptions', 406),
  ('5.1.8', 'Despesas - Seguros', 'expense', 'insurance', 407),
  ('5.1.9', 'Despesas - Impostos', 'expense', 'taxes', 408),
  ('5.1.10', 'Despesas - Investimentos', 'expense', 'investment_fees', 409),
  ('5.1.11', 'Despesas - Outras', 'expense', 'other', 410)
) AS v(code, name, type, subtype, sort_order)
ON CONFLICT (user_id, code) DO NOTHING;

-- =============== RPC: create_journal_entry ===============
CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_entry_date date,
  p_description text,
  p_lines jsonb,
  p_reference_type text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_total_debit numeric(14,2) := 0;
  v_total_credit numeric(14,2) := 0;
  v_line record;
BEGIN
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) AS line
  LOOP
    IF v_line->>'entry_type' = 'debit' THEN
      v_total_debit := v_total_debit + (v_line->>'amount')::numeric;
    ELSE
      v_total_credit := v_total_credit + (v_line->>'amount')::numeric;
    END IF;
  END LOOP;

  IF v_total_debit != v_total_credit THEN
    RAISE EXCEPTION 'Journal entry must balance: debits %, credits %', v_total_debit, v_total_credit;
  END IF;

  INSERT INTO public.journal_entries (
    user_id, entry_date, description, reference_type, reference_id, source, metadata
  ) VALUES (
    auth.uid(), p_entry_date, p_description, p_reference_type, p_reference_id, p_source, p_metadata
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_lines (journal_entry_id, ledger_account_id, entry_type, amount, currency, description, sort_order)
  SELECT
    v_entry_id,
    (line->>'ledger_account_id')::uuid,
    (line->>'entry_type')::public.ledger_entry_type,
    (line->>'amount')::numeric,
    COALESCE(line->>'currency', 'BRL'),
    line->>'description',
    (line->>'sort_order')::int
  FROM jsonb_array_elements(p_lines) AS line;

  RETURN v_entry_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(date, text, jsonb, text, uuid, text, jsonb) TO authenticated;

-- =============== RPC: get_ledger_balances ===============
CREATE OR REPLACE FUNCTION public.get_ledger_balances(
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'assets', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', la.id, 'code', la.code, 'name', la.name, 'subtype', la.subtype,
          'balance', COALESCE(SUM(
            CASE WHEN jl.entry_type = 'debit' THEN jl.amount ELSE -jl.amount END
          ) FILTER (WHERE je.entry_date <= p_as_of_date), 0)
        ) AS t
        FROM public.ledger_accounts la
        LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
        LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
        WHERE la.user_id = auth.uid() AND la.type = 'asset' AND la.is_active = true
        GROUP BY la.id, la.code, la.name, la.subtype
        ORDER BY la.code
      ) sub
    ),
    'liabilities', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', la.id, 'code', la.code, 'name', la.name, 'subtype', la.subtype,
          'balance', COALESCE(SUM(
            CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE -jl.amount END
          ) FILTER (WHERE je.entry_date <= p_as_of_date), 0)
        ) AS t
        FROM public.ledger_accounts la
        LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
        LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
        WHERE la.user_id = auth.uid() AND la.type = 'liability' AND la.is_active = true
        GROUP BY la.id, la.code, la.name, la.subtype
        ORDER BY la.code
      ) sub
    ),
    'equity', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', la.id, 'code', la.code, 'name', la.name,
          'balance', COALESCE(SUM(
            CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE -jl.amount END
          ) FILTER (WHERE je.entry_date <= p_as_of_date), 0)
        ) AS t
        FROM public.ledger_accounts la
        LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
        LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
        WHERE la.user_id = auth.uid() AND la.type = 'equity' AND la.is_active = true
        GROUP BY la.id, la.code, la.name
        ORDER BY la.code
      ) sub
    ),
    'revenue', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', la.id, 'code', la.code, 'name', la.name, 'subtype', la.subtype,
          'balance', COALESCE(SUM(
            CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE -jl.amount END
          ) FILTER (WHERE je.entry_date <= p_as_of_date), 0)
        ) AS t
        FROM public.ledger_accounts la
        LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
        LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
        WHERE la.user_id = auth.uid() AND la.type = 'revenue' AND la.is_active = true
        GROUP BY la.id, la.code, la.name, la.subtype
        ORDER BY la.code
      ) sub
    ),
    'expenses', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', la.id, 'code', la.code, 'name', la.name, 'subtype', la.subtype,
          'balance', COALESCE(SUM(
            CASE WHEN jl.entry_type = 'debit' THEN jl.amount ELSE -jl.amount END
          ) FILTER (WHERE je.entry_date <= p_as_of_date), 0)
        ) AS t
        FROM public.ledger_accounts la
        LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
        LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
        WHERE la.user_id = auth.uid() AND la.type = 'expense' AND la.is_active = true
        GROUP BY la.id, la.code, la.name, la.subtype
        ORDER BY la.code
      ) sub
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_ledger_balances(date) TO authenticated;

-- =============== RPC: create_transaction_from_external ===============
CREATE OR REPLACE FUNCTION public.create_transaction_from_external(
  p_external_transaction_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ext record;
  v_tx_id uuid;
  v_category_id uuid;
  v_user_id uuid;
BEGIN
  SELECT et.*, ac.user_id INTO v_ext
  FROM public.external_transactions et
  JOIN public.account_connections ac ON ac.id = et.connection_id
  WHERE et.id = p_external_transaction_id AND ac.user_id = auth.uid();

  IF v_ext IS NULL THEN
    RAISE EXCEPTION 'External transaction not found or access denied';
  END IF;

  v_user_id := v_ext.user_id;

  IF v_ext.mcc IS NOT NULL THEN
    SELECT id INTO v_category_id
    FROM public.transaction_categories
    WHERE code = 'mcc_' || v_ext.mcc
    LIMIT 1;
  END IF;

  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM public.transaction_categories
    WHERE code = 'other_unclassified'
    LIMIT 1;
  END IF;

  INSERT INTO public.transactions (
    user_id, account_id, external_transaction_id, amount, currency,
    description, merchant_name, category_id, status, posted_at, authorized_at,
    metadata
  ) VALUES (
    v_user_id, v_ext.account_id, v_ext.id, v_ext.amount, v_ext.currency,
    v_ext.description, v_ext.merchant_name, v_category_id, v_ext.status,
    v_ext.posted_at, v_ext.authorized_at,
    jsonb_build_object('mcc', v_ext.mcc, 'raw_data', v_ext.raw_data)
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.transaction_enrichments (
    transaction_id, category_id, confidence, source, reason
  ) VALUES (
    v_tx_id, v_category_id, 0.5, 'mcc', 'Initial categorization by MCC'
  );

  RETURN v_tx_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_transaction_from_external(uuid) TO authenticated;

-- =============== RPC: pair_transfer ===============
CREATE OR REPLACE FUNCTION public.pair_transfer(
  p_debit_transaction_id uuid,
  p_credit_transaction_id uuid,
  p_is_manual boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_debit record;
  v_credit record;
  v_pair_id uuid;
  v_transfer_cat_id uuid;
BEGIN
  SELECT t.*, tc.code as cat_code INTO v_debit
  FROM public.transactions t
  LEFT JOIN public.transaction_categories tc ON tc.id = t.category_id
  WHERE t.id = p_debit_transaction_id AND t.user_id = auth.uid();

  SELECT t.*, tc.code as cat_code INTO v_credit
  FROM public.transactions t
  LEFT JOIN public.transaction_categories tc ON tc.id = t.category_id
  WHERE t.id = p_credit_transaction_id AND t.user_id = auth.uid();

  IF v_debit IS NULL OR v_credit IS NULL THEN
    RAISE EXCEPTION 'One or both transactions not found or access denied';
  END IF;

  IF v_debit.amount != v_credit.amount THEN
    RAISE EXCEPTION 'Transfer amounts must match';
  END IF;

  IF v_debit.currency != v_credit.currency THEN
    RAISE EXCEPTION 'Transfer currencies must match';
  END IF;

  SELECT id INTO v_transfer_cat_id
  FROM public.transaction_categories
  WHERE code = 'transfer_internal'
  LIMIT 1;

  INSERT INTO public.transaction_pairs (
    user_id, debit_transaction_id, credit_transaction_id, amount, currency, is_manual
  ) VALUES (
    auth.uid(), p_debit_transaction_id, p_credit_transaction_id,
    v_debit.amount, v_debit.currency, p_is_manual
  ) RETURNING id INTO v_pair_id;

  UPDATE public.transactions
  SET is_transfer = true, transfer_pair_id = v_pair_id, category_id = v_transfer_cat_id
  WHERE id IN (p_debit_transaction_id, p_credit_transaction_id);

  PERFORM public.create_journal_entry(
    v_debit.posted_at::date,
    'Transferência entre contas: ' || v_debit.description,
    jsonb_build_array(
      jsonb_build_object(
        'ledger_account_id', (SELECT id FROM public.ledger_accounts WHERE user_id = auth.uid() AND account_id = v_debit.account_id),
        'entry_type', 'credit',
        'amount', v_debit.amount,
        'description', 'Saída: ' || v_debit.description,
        'sort_order', 1
      ),
      jsonb_build_object(
        'ledger_account_id', (SELECT id FROM public.ledger_accounts WHERE user_id = auth.uid() AND account_id = v_credit.account_id),
        'entry_type', 'debit',
        'amount', v_credit.amount,
        'description', 'Entrada: ' || v_credit.description,
        'sort_order', 2
      )
    ),
    'transfer',
    v_pair_id,
    'auto'
  );

  RETURN v_pair_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pair_transfer(uuid, uuid, boolean) TO authenticated;

-- =============== RPC: get_transactions_summary ===============
CREATE OR REPLACE FUNCTION public.get_transactions_summary(
  p_start_date date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'totals', (
      SELECT jsonb_build_object(
        'income', COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0),
        'expense', COALESCE(SUM(amount) FILTER (WHERE amount < 0), 0),
        'net', COALESCE(SUM(amount), 0),
        'count', COUNT(*)
      )
      FROM public.transactions
      WHERE user_id = auth.uid()
        AND posted_at::date BETWEEN p_start_date AND p_end_date
        AND is_transfer = false
    ),
    'by_category', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'category_id', tc.id,
          'category_code', tc.code,
          'category_name', tc.name,
          'parent_code', tpc.code,
          'total', SUM(t.amount),
          'count', COUNT(*)
        ) AS t
        FROM public.transactions t
        LEFT JOIN public.transaction_categories tc ON tc.id = t.category_id
        LEFT JOIN public.transaction_categories tpc ON tpc.id = tc.parent_id
        WHERE t.user_id = auth.uid()
          AND t.posted_at::date BETWEEN p_start_date AND p_end_date
          AND t.is_transfer = false
        GROUP BY tc.id, tc.code, tc.name, tpc.code
        ORDER BY SUM(t.amount) ASC
      ) sub
    ),
    'by_account', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'account_id', a.id,
          'account_name', a.name,
          'institution', COALESCE(i.name, a.institution),
          'total', SUM(t.amount),
          'count', COUNT(*)
        ) AS t
        FROM public.transactions t
        JOIN public.accounts a ON a.id = t.account_id
        LEFT JOIN public.institutions i ON i.id = a.institution_id
        WHERE t.user_id = auth.uid()
          AND t.posted_at::date BETWEEN p_start_date AND p_end_date
          AND t.is_transfer = false
        GROUP BY a.id, a.name, i.name
        ORDER BY SUM(t.amount) ASC
      ) sub
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_transactions_summary(date, date) TO authenticated;

-- =============== RPC: detect_transfer_candidates ===============
CREATE OR REPLACE FUNCTION public.detect_transfer_candidates(
  p_user_id uuid,
  p_window_days int DEFAULT 3
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'debit_id', debit.id,
      'credit_id', credit.id,
      'amount', debit.amount,
      'date_diff', ABS(EXTRACT(DAY FROM (debit.posted_at - credit.posted_at)))
    ) AS t
    FROM public.transactions debit
    JOIN public.transactions credit
      ON credit.user_id = debit.user_id
     AND credit.amount = debit.amount
     AND credit.currency = debit.currency
     AND credit.account_id != debit.account_id
     AND debit.amount < 0
     AND credit.amount > 0
    WHERE debit.user_id = p_user_id
      AND credit.posted_at BETWEEN debit.posted_at - (p_window_days || ' days')::interval
                               AND debit.posted_at + (p_window_days || ' days')::interval
      AND (credit.description ILIKE '%' || debit.description || '%'
           OR debit.description ILIKE '%' || credit.description || '%'
           OR (credit.merchant_name IS NOT NULL AND debit.merchant_name IS NOT NULL
               AND credit.merchant_name ILIKE '%' || debit.merchant_name || '%'))
    ORDER BY ABS(EXTRACT(DAY FROM (debit.posted_at - credit.posted_at)))
    LIMIT 50
  ) sub;
$$;
GRANT EXECUTE ON FUNCTION public.detect_transfer_candidates(uuid, int) TO authenticated;

-- =============== INDEXES ===============
CREATE INDEX IF NOT EXISTS idx_transaction_categories_parent_id ON public.transaction_categories(parent_id);