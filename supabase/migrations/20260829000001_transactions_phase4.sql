-- ============================================================
-- FASE 4: Motor de Transações — Pipeline Completo + Ledger
-- ============================================================
-- Schema atualizado: transaction_categories já evoluída pela migration 20260829000000
-- transaction_categories columns: id, code, label, name, parent_code, kind, parent_id, icon, color, is_system, sort_order, created_at, updated_at

-- =============== TYPES ===============
DO $$ BEGIN
  CREATE TYPE public.categorization_source AS ENUM (
    'mcc', 'rule', 'user', 'ml', 'llm', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM (
    'pending', 'settled', 'cancelled', 'failed', 'reversed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============== EXTERNAL TRANSACTIONS (raw from provider) ===============
CREATE TABLE IF NOT EXISTS public.external_transactions (
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
DROP POLICY IF EXISTS external_transactions_own ON public.external_transactions;
CREATE POLICY external_transactions_own ON public.external_transactions
  FOR ALL TO authenticated
  USING (connection_id IN (
    SELECT id FROM public.account_connections WHERE user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_external_transactions_account ON public.external_transactions(account_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_transactions_connection ON public.external_transactions(connection_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_transactions_posted ON public.external_transactions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_transactions_processed ON public.external_transactions(processed_at) WHERE processed_at IS NULL;

-- =============== TRANSACTION ENRICHMENTS (categorization audit trail) ===============
CREATE TABLE IF NOT EXISTS public.transaction_enrichments (
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
DROP POLICY IF EXISTS transaction_enrichments_own ON public.transaction_enrichments;
CREATE POLICY transaction_enrichments_own ON public.transaction_enrichments
  FOR ALL TO authenticated
  USING (transaction_id IN (
    SELECT id FROM public.transactions WHERE user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_transaction_enrichments_tx ON public.transaction_enrichments(transaction_id, created_at DESC);

-- =============== TRANSACTION TAGS (user-defined) ===============
CREATE TABLE IF NOT EXISTS public.transaction_tags (
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
DROP POLICY IF EXISTS transaction_tags_own ON public.transaction_tags;
CREATE POLICY transaction_tags_own ON public.transaction_tags
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== TRANSACTION PAIRS (transfers between own accounts) ===============
CREATE TABLE IF NOT EXISTS public.transaction_pairs (
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
DROP POLICY IF EXISTS transaction_pairs_own ON public.transaction_pairs;
CREATE POLICY transaction_pairs_own ON public.transaction_pairs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_pairs_user ON public.transaction_pairs(user_id, matched_at DESC);

-- =============== LEDGER ACCOUNTS (chart of accounts) ===============
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
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
DROP POLICY IF EXISTS ledger_accounts_own ON public.ledger_accounts;
CREATE POLICY ledger_accounts_own ON public.ledger_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_user ON public.ledger_accounts(user_id, type, code);

-- =============== JOURNAL ENTRIES ===============
CREATE TABLE IF NOT EXISTS public.journal_entries (
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
DROP POLICY IF EXISTS journal_entries_own ON public.journal_entries;
CREATE POLICY journal_entries_own ON public.journal_entries
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries(reference_type, reference_id);

-- =============== JOURNAL LINES ===============
CREATE TABLE IF NOT EXISTS public.journal_lines (
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
DROP POLICY IF EXISTS journal_lines_own ON public.journal_lines;
CREATE POLICY journal_lines_own ON public.journal_lines
  FOR ALL TO authenticated
  USING (journal_entry_id IN (
    SELECT id FROM public.journal_entries WHERE user_id = auth.uid()
  ) AND ledger_account_id IN (
    SELECT id FROM public.ledger_accounts WHERE user_id = auth.uid()
  ))
  WITH CHECK (journal_entry_id IN (
    SELECT id FROM public.journal_entries WHERE user_id = auth.uid()
  ) AND ledger_account_id IN (
    SELECT id FROM public.ledger_accounts WHERE user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(ledger_account_id);

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

-- Mantem o contrato legado (category/merchant/occurred_at) sincronizado com o
-- novo contrato (category_id/merchant_name/posted_at). A UI atual ainda le os
-- campos legados, enquanto o pipeline Open Finance usa os novos campos.
CREATE OR REPLACE FUNCTION public.sync_transaction_compatibility_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
  v_category_code text;
  v_category_name text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN
    NEW.posted_at := COALESCE(NEW.posted_at, NEW.occurred_at::timestamptz);
    NEW.occurred_at := NEW.posted_at::date;
  ELSIF NEW.occurred_at IS DISTINCT FROM OLD.occurred_at THEN
    NEW.posted_at := NEW.occurred_at::timestamptz;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.merchant_name IS DISTINCT FROM OLD.merchant_name THEN
    NEW.merchant_name := COALESCE(NEW.merchant_name, NEW.merchant);
    NEW.merchant := NEW.merchant_name;
  ELSIF NEW.merchant IS DISTINCT FROM OLD.merchant THEN
    NEW.merchant_name := NEW.merchant;
  END IF;

  IF NEW.is_transfer THEN
    NEW.type := 'transfer';
  ELSIF NEW.amount > 0 THEN
    NEW.type := 'income';
  ELSE
    NEW.type := 'expense';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    SELECT id, code, COALESCE(name, label, code)
    INTO v_category_id, v_category_code, v_category_name
    FROM public.transaction_categories
    WHERE id = NEW.category_id;

    IF v_category_id IS NOT NULL THEN
      NEW.category := v_category_name;
    END IF;
  ELSIF NEW.category IS DISTINCT FROM OLD.category THEN
    SELECT id, code
    INTO v_category_id, v_category_code
    FROM public.transaction_categories
    WHERE lower(code) = lower(NEW.category)
       OR lower(name) = lower(NEW.category)
       OR lower(label) = lower(NEW.category)
    ORDER BY CASE WHEN lower(code) = lower(NEW.category) THEN 0 ELSE 1 END
    LIMIT 1;

    SELECT id INTO v_category_id
    FROM public.transaction_categories
    WHERE code = COALESCE(v_category_code, 'other_unclassified')
    LIMIT 1;

    NEW.category_id := v_category_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_compatibility_fields ON public.transactions;
CREATE TRIGGER transactions_compatibility_fields
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_compatibility_fields();

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
CREATE TABLE IF NOT EXISTS public.user_categorization_rules (
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
DROP POLICY IF EXISTS user_categorization_rules_own ON public.user_categorization_rules;
CREATE POLICY user_categorization_rules_own ON public.user_categorization_rules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS user_categorization_rules_updated_at ON public.user_categorization_rules;
CREATE TRIGGER user_categorization_rules_updated_at BEFORE UPDATE ON public.user_categorization_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_user_categorization_rules_user ON public.user_categorization_rules(user_id, priority DESC);

-- =============== DEFAULT LEDGER ACCOUNTS (seed data) ===============
-- Migrations nao possuem sessao de usuario; portanto auth.uid() e NULL durante
-- o deploy. O seed recebe o usuario explicitamente, atende usuarios existentes
-- e tambem e executado para novos cadastros por trigger.
CREATE OR REPLACE FUNCTION public.seed_default_ledger_accounts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'A valid user_id is required to seed ledger accounts';
  END IF;

  INSERT INTO public.ledger_accounts (user_id, code, name, type, subtype, is_system, sort_order)
  SELECT p_user_id, code, name, type, subtype, true, sort_order
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
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_ledger_accounts(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.initialize_user_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.seed_default_ledger_accounts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_ledger ON auth.users;
CREATE TRIGGER on_auth_user_created_ledger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_ledger();

SELECT public.seed_default_ledger_accounts(id)
FROM auth.users;

-- Cada conta financeira precisa de uma contraparte propria no ledger. Sem
-- esse vinculo, pair_transfer gera linhas com ledger_account_id nulo.
CREATE OR REPLACE FUNCTION public.sync_financial_account_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ledger_accounts (
    user_id, code, name, type, subtype, account_id, is_system, is_active, sort_order
  ) VALUES (
    NEW.user_id,
    'account.' || NEW.id::text,
    NEW.name,
    CASE WHEN NEW.type = 'credit' THEN 'liability' ELSE 'asset' END,
    NEW.type::text,
    NEW.id,
    false,
    NOT COALESCE(NEW.is_archived, false),
    50
  )
  ON CONFLICT (user_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    subtype = EXCLUDED.subtype,
    account_id = EXCLUDED.account_id,
    is_active = EXCLUDED.is_active;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_sync_ledger ON public.accounts;
CREATE TRIGGER accounts_sync_ledger
  AFTER INSERT OR UPDATE OF name, type, is_archived ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_financial_account_ledger();

INSERT INTO public.ledger_accounts (
  user_id, code, name, type, subtype, account_id, is_system, is_active, sort_order
)
SELECT
  a.user_id,
  'account.' || a.id::text,
  a.name,
  CASE WHEN a.type = 'credit' THEN 'liability' ELSE 'asset' END,
  a.type::text,
  a.id,
  false,
  NOT a.is_archived,
  50
FROM public.accounts a
ON CONFLICT (user_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  subtype = EXCLUDED.subtype,
  account_id = EXCLUDED.account_id,
  is_active = EXCLUDED.is_active;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least two lines';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) AS line
  LOOP
    IF (v_line->>'amount')::numeric <= 0 THEN
      RAISE EXCEPTION 'Journal line amounts must be positive';
    END IF;

    IF v_line->>'entry_type' NOT IN ('debit', 'credit') THEN
      RAISE EXCEPTION 'Invalid journal entry type';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.ledger_accounts la
      WHERE la.id = (v_line->>'ledger_account_id')::uuid
        AND la.user_id = auth.uid()
        AND la.is_active
    ) THEN
      RAISE EXCEPTION 'Ledger account not found or access denied';
    END IF;

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
    COALESCE((line->>'sort_order')::int, 0)
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

  IF abs(v_debit.amount) != abs(v_credit.amount)
     OR v_debit.amount >= 0
     OR v_credit.amount <= 0 THEN
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
    abs(v_debit.amount), v_debit.currency, p_is_manual
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
        'amount', abs(v_debit.amount),
        'description', 'Saída: ' || v_debit.description,
        'sort_order', 1
      ),
      jsonb_build_object(
        'ledger_account_id', (SELECT id FROM public.ledger_accounts WHERE user_id = auth.uid() AND account_id = v_credit.account_id),
        'entry_type', 'debit',
        'amount', abs(v_credit.amount),
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
     AND credit.amount = abs(debit.amount)
     AND credit.currency = debit.currency
     AND credit.account_id != debit.account_id
     AND debit.amount < 0
     AND credit.amount > 0
    WHERE debit.user_id = auth.uid()
      AND p_user_id = auth.uid()
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
