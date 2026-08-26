-- =============== EXTENSIONS ===============
CREATE EXTENSION IF NOT EXISTS vector;

-- =============== MASTER DATA ===============
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL DEFAULT '',
  logo_color text NOT NULL DEFAULT '#6366f1',
  openfinance_participant boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutions TO anon, authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY institutions_public_read ON public.institutions FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER institutions_updated_at BEFORE UPDATE ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  parent_code text,
  kind text NOT NULL DEFAULT 'expense',
  color text NOT NULL DEFAULT 'chart-1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transaction_categories TO anon, authenticated;
GRANT ALL ON public.transaction_categories TO service_role;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_public_read ON public.transaction_categories FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.transaction_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== USER TABLES ===============
CREATE TYPE public.asset_class AS ENUM ('stock','fii','fixed_income','crypto','fund','etf','cash');
CREATE TYPE public.bill_status AS ENUM ('pending','paid','overdue','canceled');
CREATE TYPE public.consent_status AS ENUM ('pending','authorised','revoked','expired');

CREATE TABLE public.investment_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ticker text NOT NULL,
  name text NOT NULL DEFAULT '',
  asset_class public.asset_class NOT NULL DEFAULT 'stock',
  quantity numeric(18,6) NOT NULL DEFAULT 0,
  average_price numeric(14,2) NOT NULL DEFAULT 0,
  current_price numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_positions TO authenticated;
GRANT ALL ON public.investment_positions TO service_role;
ALTER TABLE public.investment_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY investment_positions_own ON public.investment_positions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER investment_positions_updated_at BEFORE UPDATE ON public.investment_positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_investment_positions_user ON public.investment_positions(user_id);

CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.bill_status NOT NULL DEFAULT 'pending',
  category text NOT NULL DEFAULT 'Outros',
  recurring boolean NOT NULL DEFAULT false,
  barcode text,
  pix_key text,
  scheduled_for timestamptz,
  confirmation_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY payables_own ON public.payables FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER payables_updated_at BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payables_user_due ON public.payables(user_id, due_date);

CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.bill_status NOT NULL DEFAULT 'pending',
  payer text NOT NULL DEFAULT '',
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY receivables_own ON public.receivables FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER receivables_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_receivables_user_due ON public.receivables(user_id, due_date);

CREATE TABLE public.tax_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'swing',
  asset_class public.asset_class NOT NULL DEFAULT 'stock',
  ticker text NOT NULL DEFAULT '',
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  profit numeric(14,2) NOT NULL DEFAULT 0,
  withheld numeric(14,2) NOT NULL DEFAULT 0,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_events TO authenticated;
GRANT ALL ON public.tax_events TO service_role;
ALTER TABLE public.tax_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_events_own ON public.tax_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tax_events_updated_at BEFORE UPDATE ON public.tax_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_tax_events_user_date ON public.tax_events(user_id, occurred_at);

CREATE TABLE public.net_worth_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  net_worth numeric(14,2) NOT NULL DEFAULT 0,
  liquidity numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.net_worth_snapshots TO authenticated;
GRANT ALL ON public.net_worth_snapshots TO service_role;
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY net_worth_own ON public.net_worth_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER net_worth_updated_at BEFORE UPDATE ON public.net_worth_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_conversations TO authenticated;
GRANT ALL ON public.agent_conversations TO service_role;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_conversations_own ON public.agent_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_messages_own ON public.agent_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_messages_updated_at BEFORE UPDATE ON public.agent_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_agent_messages_conv ON public.agent_messages(conversation_id, created_at);

CREATE TABLE public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL DEFAULT 'preference',
  content text NOT NULL,
  embedding vector(1536),
  importance real NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memories TO authenticated;
GRANT ALL ON public.agent_memories TO service_role;
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_memories_own ON public.agent_memories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_memories_updated_at BEFORE UPDATE ON public.agent_memories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_agent_memories_embedding ON public.agent_memories USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE public.openfinance_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  consent_id text,
  status public.consent_status NOT NULL DEFAULT 'pending',
  scopes text[] NOT NULL DEFAULT ARRAY['accounts','transactions']::text[],
  state text,
  code_verifier text,
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openfinance_consents TO authenticated;
GRANT ALL ON public.openfinance_consents TO service_role;
ALTER TABLE public.openfinance_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY openfinance_consents_own ON public.openfinance_consents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER openfinance_consents_updated_at BEFORE UPDATE ON public.openfinance_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.openfinance_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_id uuid NOT NULL REFERENCES public.openfinance_consents(id) ON DELETE CASCADE,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.openfinance_tokens TO service_role;
ALTER TABLE public.openfinance_tokens ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER openfinance_tokens_updated_at BEFORE UPDATE ON public.openfinance_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_own_read ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);

-- =============== AUDIT TRIGGER ===============
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id; v_id := OLD.id;
    INSERT INTO public.audit_logs(user_id, table_name, operation, record_id, old_data)
    VALUES (v_user, TG_TABLE_NAME, TG_OP, v_id, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    v_user := NEW.user_id; v_id := NEW.id;
    INSERT INTO public.audit_logs(user_id, table_name, operation, record_id, old_data, new_data)
    VALUES (v_user, TG_TABLE_NAME, TG_OP, v_id,
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_payables AFTER INSERT OR UPDATE OR DELETE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_goals AFTER INSERT OR UPDATE OR DELETE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_agent_memories AFTER INSERT OR UPDATE OR DELETE ON public.agent_memories FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============== RPCs ===============
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, content text, memory_type text, similarity float)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.id, m.content, m.memory_type, 1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memories m
  WHERE m.user_id = auth.uid()
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_agent_memories(vector, float, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_cashflow_projection(horizon_days int DEFAULT 90)
RETURNS TABLE (month date, income numeric, expenses numeric, projected numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT date_trunc('month', t.occurred_at)::date AS m,
           SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS inc,
           SUM(CASE WHEN t.type = 'expense' THEN ABS(t.amount) ELSE 0 END) AS exp
    FROM public.transactions t
    WHERE t.user_id = auth.uid()
      AND t.occurred_at >= (CURRENT_DATE - make_interval(days => horizon_days))
    GROUP BY 1
  )
  SELECT m, inc, exp, inc - exp FROM base ORDER BY m;
$$;
GRANT EXECUTE ON FUNCTION public.get_cashflow_projection(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.calculate_irpf_monthly(p_year int, p_month int)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT * FROM public.tax_events
    WHERE user_id = auth.uid()
      AND EXTRACT(YEAR FROM occurred_at) = p_year
      AND EXTRACT(MONTH FROM occurred_at) = p_month
  ),
  agg AS (
    SELECT
      COALESCE(SUM(CASE WHEN kind = 'swing' AND asset_class = 'stock' THEN gross_amount ELSE 0 END), 0) AS swing_gross,
      COALESCE(SUM(CASE WHEN kind = 'swing' AND asset_class = 'stock' THEN profit ELSE 0 END), 0) AS swing_profit,
      COALESCE(SUM(CASE WHEN kind = 'daytrade' THEN profit ELSE 0 END), 0) AS daytrade_profit,
      COALESCE(SUM(CASE WHEN asset_class = 'fii' THEN profit ELSE 0 END), 0) AS fii_profit,
      COALESCE(SUM(CASE WHEN kind = 'dividend' THEN gross_amount ELSE 0 END), 0) AS dividends,
      COALESCE(SUM(withheld), 0) AS withheld
    FROM ev
  )
  SELECT jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'swing_gross', swing_gross,
    'swing_exempt', swing_gross <= 20000,
    'swing_tax', CASE WHEN swing_gross <= 20000 THEN 0 ELSE GREATEST(swing_profit, 0) * 0.15 END,
    'daytrade_tax', GREATEST(daytrade_profit, 0) * 0.20,
    'fii_tax', GREATEST(fii_profit, 0) * 0.20,
    'dividends', dividends,
    'withheld', withheld,
    'darf_due', GREATEST(
      (CASE WHEN swing_gross <= 20000 THEN 0 ELSE GREATEST(swing_profit, 0) * 0.15 END)
      + GREATEST(daytrade_profit, 0) * 0.20
      + GREATEST(fii_profit, 0) * 0.20
      - withheld, 0)
  ) FROM agg;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_irpf_monthly(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_transaction_idempotent(p_idempotency_key text, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.transactions
  WHERE user_id = auth.uid() AND external_id = p_idempotency_key;

  IF v_id IS NOT NULL THEN
    UPDATE public.transactions SET
      description = COALESCE(p_data->>'description', description),
      amount = COALESCE((p_data->>'amount')::numeric, amount),
      category = COALESCE(p_data->>'category', category)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, merchant, method, occurred_at, external_id)
  VALUES (
    auth.uid(),
    NULLIF(p_data->>'account_id','')::uuid,
    COALESCE(p_data->>'description','Transação'),
    COALESCE((p_data->>'amount')::numeric, 0),
    COALESCE((p_data->>'type')::public.transaction_type, 'expense'),
    COALESCE(p_data->>'category','Outros'),
    p_data->>'merchant',
    p_data->>'method',
    COALESCE((p_data->>'occurred_at')::date, CURRENT_DATE),
    p_idempotency_key
  ) RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external ON public.transactions(user_id, external_id) WHERE external_id IS NOT NULL;
GRANT EXECUTE ON FUNCTION public.upsert_transaction_idempotent(text, jsonb) TO authenticated;

-- =============== SEEDS ===============
INSERT INTO public.institutions (code, name, short_name, logo_color) VALUES
  ('001','Banco do Brasil','BB','#f6c700'),
  ('033','Santander Brasil','Santander','#ec0000'),
  ('077','Banco Inter','Inter','#ff7a00'),
  ('104','Caixa Econômica Federal','Caixa','#0070af'),
  ('208','BTG Pactual','BTG','#0f2b46'),
  ('237','Bradesco','Bradesco','#cc092f'),
  ('260','Nu Pagamentos (Nubank)','Nubank','#820ad1'),
  ('290','PagBank','PagBank','#00a868'),
  ('323','Mercado Pago','Mercado Pago','#00b1ea'),
  ('341','Itaú Unibanco','Itaú','#ec7000'),
  ('380','PicPay','PicPay','#21c25e'),
  ('102','XP Investimentos','XP','#0b0b0b');

INSERT INTO public.transaction_categories (code, label, parent_code, kind, color) VALUES
  ('INCOME','Receita',NULL,'income','chart-2'),
  ('SALARY','Salário','INCOME','income','chart-2'),
  ('FREELANCE','Freelance','INCOME','income','chart-2'),
  ('DIVIDENDS','Dividendos','INCOME','income','chart-2'),
  ('FIXED','Despesa Fixa',NULL,'expense','chart-3'),
  ('HOUSING','Moradia','FIXED','expense','chart-3'),
  ('UTILITIES','Contas de Consumo','FIXED','expense','chart-3'),
  ('EDUCATION','Educação','FIXED','expense','chart-3'),
  ('HEALTH','Saúde','FIXED','expense','chart-3'),
  ('VARIABLE','Despesa Variável',NULL,'expense','chart-4'),
  ('GROCERIES','Mercado','VARIABLE','expense','chart-4'),
  ('DINING_OUT','Alimentação Fora','VARIABLE','expense','chart-4'),
  ('TRANSPORT','Transporte','VARIABLE','expense','chart-4'),
  ('SHOPPING_ONLINE','Compras Online','VARIABLE','expense','chart-4'),
  ('ENTERTAINMENT','Lazer','VARIABLE','expense','chart-4'),
  ('CREDIT_CARD_GENERAL','Cartão (Geral)','VARIABLE','expense','chart-4'),
  ('INVESTMENT','Investimento',NULL,'investment','chart-5'),
  ('STOCKS','Ações','INVESTMENT','investment','chart-5'),
  ('FIIS','Fundos Imobiliários','INVESTMENT','investment','chart-5'),
  ('FIXED_INCOME','Renda Fixa','INVESTMENT','investment','chart-5'),
  ('TAX','Imposto',NULL,'tax','chart-1'),
  ('IRPF','IRPF','TAX','tax','chart-1'),
  ('DARF','DARF','TAX','tax','chart-1'),
  ('TRANSFER','Transferência',NULL,'transfer','chart-1'),
  ('TRANSFER_IN','Transferência Recebida','TRANSFER','transfer','chart-1'),
  ('TRANSFER_OUT','Transferência Enviada','TRANSFER','transfer','chart-1');