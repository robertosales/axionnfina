-- Importacao auditavel de extratos e faturas, com previa antes dos lancamentos.
CREATE TABLE IF NOT EXISTS public.financial_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  document_kind text NOT NULL CHECK (document_kind IN ('statement', 'credit_invoice')),
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv', 'xml', 'pdf')),
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'confirmed', 'failed', 'cancelled')),
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  imported_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  due_date date,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv', 'xml', 'pdf')),
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'confirmed', 'cancelled')),
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id, reference_month)
);

CREATE TABLE IF NOT EXISTS public.credit_card_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.credit_card_invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_date date NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  installment text,
  external_id text NOT NULL,
  category_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  UNIQUE (user_id, external_id)
);

ALTER TABLE public.financial_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_import_batches_own ON public.financial_import_batches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY credit_card_invoices_own ON public.credit_card_invoices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY credit_card_invoice_items_own ON public.credit_card_invoice_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.financial_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_invoice_items TO authenticated;
