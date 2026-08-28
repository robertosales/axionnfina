-- ============================================================
-- FASE 4: Motor de Transações — Evolução da tabela transaction_categories
-- ============================================================
-- A tabela transaction_categories já existe na migration 20260826121335
-- Schema atual: id, code, label, parent_code, kind, color, created_at, updated_at
-- Esta migration adiciona colunas necessárias para o novo schema

-- =============== 1. ADICIONAR COLUNAS NOVAS ===============
ALTER TABLE public.transaction_categories
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- =============== 2. MIGRAR DADOS: label -> name ===============
UPDATE public.transaction_categories
SET name = label
WHERE name IS NULL;

-- =============== 3. MIGRAR DADOS: parent_code -> parent_id ===============
UPDATE public.transaction_categories tc
SET parent_id = pc.id
FROM public.transaction_categories pc
WHERE tc.parent_code = pc.code
  AND tc.parent_id IS NULL;

-- =============== 4. ATUALIZAR CATEGORIAS EXISTENTES COM NOVOS CAMPOS ===============
UPDATE public.transaction_categories SET
  icon = CASE code
    WHEN 'INCOME' THEN 'arrow-down-circle'
    WHEN 'SALARY' THEN 'briefcase'
    WHEN 'FREELANCE' THEN 'laptop'
    WHEN 'DIVIDENDS' THEN 'dollar-sign'
    WHEN 'FIXED' THEN 'calendar'
    WHEN 'HOUSING' THEN 'home'
    WHEN 'UTILITIES' THEN 'wifi'
    WHEN 'EDUCATION' THEN 'book-open'
    WHEN 'HEALTH' THEN 'heart'
    WHEN 'VARIABLE' THEN 'shopping-bag'
    WHEN 'GROCERIES' THEN 'utensils'
    WHEN 'DINING_OUT' THEN 'utensils'
    WHEN 'TRANSPORT' THEN 'car'
    WHEN 'SHOPPING_ONLINE' THEN 'shopping-bag'
    WHEN 'ENTERTAINMENT' THEN 'gamepad-2'
    WHEN 'CREDIT_CARD_GENERAL' THEN 'credit-card'
    WHEN 'INVESTMENT' THEN 'trending-up'
    WHEN 'STOCKS' THEN 'trending-up'
    WHEN 'FIIS' THEN 'building'
    WHEN 'FIXED_INCOME' THEN 'landmark'
    WHEN 'TAX' THEN 'file-text'
    WHEN 'IRPF' THEN 'calculator'
    WHEN 'DARF' THEN 'file-text'
    WHEN 'TRANSFER' THEN 'arrow-left-right'
    WHEN 'TRANSFER_IN' THEN 'download'
    WHEN 'TRANSFER_OUT' THEN 'send'
    ELSE 'more-horizontal'
  END,
  is_system = true,
  sort_order = CASE code
    WHEN 'INCOME' THEN 10
    WHEN 'SALARY' THEN 11
    WHEN 'FREELANCE' THEN 12
    WHEN 'DIVIDENDS' THEN 13
    WHEN 'FIXED' THEN 20
    WHEN 'HOUSING' THEN 21
    WHEN 'UTILITIES' THEN 22
    WHEN 'EDUCATION' THEN 23
    WHEN 'HEALTH' THEN 24
    WHEN 'VARIABLE' THEN 30
    WHEN 'GROCERIES' THEN 31
    WHEN 'DINING_OUT' THEN 32
    WHEN 'TRANSPORT' THEN 33
    WHEN 'SHOPPING_ONLINE' THEN 34
    WHEN 'ENTERTAINMENT' THEN 35
    WHEN 'CREDIT_CARD_GENERAL' THEN 36
    WHEN 'INVESTMENT' THEN 50
    WHEN 'STOCKS' THEN 51
    WHEN 'FIIS' THEN 52
    WHEN 'FIXED_INCOME' THEN 53
    WHEN 'TAX' THEN 60
    WHEN 'IRPF' THEN 61
    WHEN 'DARF' THEN 62
    WHEN 'TRANSFER' THEN 40
    WHEN 'TRANSFER_IN' THEN 41
    WHEN 'TRANSFER_OUT' THEN 42
    ELSE 90
  END
WHERE is_system = true;

-- =============== 5. INSERIR NOVAS CATEGORIAS FILHAS (referenciam pais existentes) ===============
-- Formato: (code, name, parent_code, icon, color, sort_order) — 6 valores
INSERT INTO public.transaction_categories (code, label, name, parent_id, icon, color, kind, is_system, sort_order)
SELECT v.code, v.name, v.name, pc.id, v.icon, v.color, 'expense', true, v.sort_order
FROM (VALUES
  -- Receitas adicionais (pai: INCOME)
  ('income_other', 'Outras Receitas', 'INCOME', 'plus-circle', '#14532d', 14),

  -- Despesas Fixas expandidas (pai: FIXED)
  ('expense_condo', 'Condomínio', 'FIXED', 'building', '#b91c1c', 22),
  ('expense_internet', 'Internet/Telefone', 'FIXED', 'wifi', '#991b1b', 23),
  ('expense_insurance', 'Seguros', 'FIXED', 'shield', '#7f1d1d', 24),
  ('expense_subscriptions', 'Assinaturas', 'FIXED', 'credit-card', '#ef4444', 25),

  -- Despesas Variáveis expandidas (pai: VARIABLE)
  ('expense_food', 'Alimentação', 'VARIABLE', 'utensils', '#ea580c', 31),
  ('expense_transport', 'Transporte', 'VARIABLE', 'car', '#c2410c', 32),
  ('expense_health', 'Saúde', 'VARIABLE', 'heart', '#9a3412', 33),
  ('expense_education', 'Educação', 'VARIABLE', 'book-open', '#7c2d12', 34),
  ('expense_leisure', 'Lazer', 'VARIABLE', 'gamepad-2', '#f97316', 35),
  ('expense_shopping', 'Compras', 'VARIABLE', 'shopping-bag', '#fb923c', 36),

  -- Transferências detalhadas (pai: TRANSFER)
  ('transfer_internal', 'Entre Contas Próprias', 'TRANSFER', 'refresh-cw', '#4f46e5', 41),
  ('transfer_pix_out', 'Pix Enviado', 'TRANSFER', 'send', '#4338ca', 42),
  ('transfer_pix_in', 'Pix Recebido', 'TRANSFER', 'download', '#3730a3', 43),

  -- Investimentos detalhados (pai: INVESTMENT)
  ('investment_buy', 'Compra', 'INVESTMENT', 'shopping-cart', '#7c3aed', 51),
  ('investment_sell', 'Venda', 'INVESTMENT', 'trending-down', '#6d28d9', 52),
  ('investment_dividend', 'Dividendos/JCP', 'INVESTMENT', 'dollar-sign', '#5b21b6', 53),
  ('investment_fee', 'Taxas/Corretagem', 'INVESTMENT', 'receipt', '#4c1d95', 54),

  -- Impostos detalhados (pai: TAX)
  ('tax_income', 'Imposto de Renda', 'TAX', 'calculator', '#db2777', 61),
  ('tax_other', 'Outros Impostos', 'TAX', 'file-text', '#be185d', 62),

  -- Outros
  ('other_unclassified', 'Não Classificado', 'TRANSFER', 'help-circle', '#4b5563', 91)
) AS v(code, name, parent_code, icon, color, sort_order)
JOIN public.transaction_categories pc ON pc.code = v.parent_code
ON CONFLICT (code) DO NOTHING;

-- =============== 6. MCC CATEGORY MAPPINGS ===============
-- Formato: (mcc_code, mcc_name, parent_code, icon, color) — 5 valores
INSERT INTO public.transaction_categories (code, label, name, parent_id, icon, color, kind, is_system, sort_order)
SELECT
  'mcc_' || m.mcc_code,
  m.mcc_name,
  m.mcc_name,
  pc.id,
  m.icon,
  m.color,
  'expense',
  true,
  1000 + ROW_NUMBER() OVER ()
FROM (VALUES
  ('5411', 'Supermercados', 'expense_food', 'utensils', '#ea580c'),
  ('5499', 'Mercados Diversos', 'expense_food', 'utensils', '#ea580c'),
  ('5812', 'Restaurantes', 'expense_food', 'utensils', '#ea580c'),
  ('5814', 'Fast Food', 'expense_food', 'utensils', '#ea580c'),
  ('5813', 'Bares', 'expense_food', 'utensils', '#ea580c'),
  ('5462', 'Padarias', 'expense_food', 'utensils', '#ea580c'),
  ('5422', 'Açougues', 'expense_food', 'utensils', '#ea580c'),
  ('5441', 'Docerias', 'expense_food', 'utensils', '#ea580c'),

  ('4111', 'Transporte Público', 'expense_transport', 'car', '#c2410c'),
  ('4121', 'Táxi', 'expense_transport', 'car', '#c2410c'),
  ('4131', 'Aplicativos de Transporte', 'expense_transport', 'car', '#c2410c'),
  ('5541', 'Postos de Combustível', 'expense_transport', 'car', '#c2410c'),
  ('7538', 'Estacionamentos', 'expense_transport', 'car', '#c2410c'),
  ('4784', 'Pedágios', 'expense_transport', 'car', '#c2410c'),

  ('8011', 'Médicos', 'expense_health', 'heart', '#9a3412'),
  ('8021', 'Dentistas', 'expense_health', 'heart', '#9a3412'),
  ('8041', 'Clínicas', 'expense_health', 'heart', '#9a3412'),
  ('8050', 'Hospitais', 'expense_health', 'heart', '#9a3412'),
  ('5912', 'Farmácias', 'expense_health', 'heart', '#9a3412'),

  ('8211', 'Escolas', 'expense_education', 'book-open', '#7c2d12'),
  ('8220', 'Faculdades', 'expense_education', 'book-open', '#7c2d12'),
  ('8299', 'Cursos Diversos', 'expense_education', 'book-open', '#7c2d12'),

  ('5311', 'Lojas de Departamento', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5399', 'Varejo Diverso', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5651', 'Roupas', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5661', 'Calçados', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5732', 'Eletrônicos', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5722', 'Eletrodomésticos', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5941', 'Livrarias', 'expense_shopping', 'shopping-bag', '#fb923c'),
  ('5944', 'Joalherias', 'expense_shopping', 'shopping-bag', '#fb923c'),

  ('6011', 'Bancos', 'FIXED', 'building', '#ef4444'),
  ('6012', 'Caixas Eletrônicos', 'FIXED', 'building', '#ef4444'),
  ('6211', 'Corretoras', 'investment_fee', 'receipt', '#4c1d95'),
  ('6300', 'Seguros', 'expense_insurance', 'shield', '#7f1d1d'),

  ('7299', 'Serviços Pessoais', 'VARIABLE', 'scissors', '#f97316'),
  ('7230', 'Salões de Beleza', 'VARIABLE', 'scissors', '#f97316'),
  ('7011', 'Hotéis', 'expense_leisure', 'bed', '#f97316'),
  ('7012', 'Pousadas', 'expense_leisure', 'bed', '#f97316'),

  ('7832', 'Cinemas', 'expense_leisure', 'film', '#f97316'),
  ('7922', 'Teatros', 'expense_leisure', 'film', '#f97316'),
  ('7991', 'Clubes', 'expense_leisure', 'film', '#f97316'),
  ('7999', 'Entretenimento', 'expense_leisure', 'film', '#f97316'),

  ('4899', 'Streaming', 'expense_subscriptions', 'tv', '#ef4444'),
  ('7372', 'Software/SaaS', 'expense_subscriptions', 'monitor', '#ef4444'),

  ('4829', 'Transferências', 'transfer_internal', 'refresh-cw', '#4f46e5'),
  ('4829', 'PIX', 'transfer_internal', 'refresh-cw', '#4f46e5'),
  ('4829', 'TED', 'transfer_internal', 'refresh-cw', '#4f46e5'),
  ('4829', 'DOC', 'transfer_internal', 'refresh-cw', '#4f46e5'),

  ('6211', 'Corretagem', 'investment_fee', 'receipt', '#4c1d95'),
  ('6211', 'Dividendos', 'investment_dividend', 'dollar-sign', '#5b21b6'),

  ('9311', 'Impostos', 'tax_other', 'file-text', '#be185d'),
  ('9399', 'Taxas Governamentais', 'tax_other', 'file-text', '#be185d')
) AS m(mcc_code, mcc_name, parent_code, icon, color)
JOIN public.transaction_categories pc ON pc.code = m.parent_code
ON CONFLICT (code) DO NOTHING;

-- =============== 7. ATUALIZAR TABELAS DE TRANSACOES EXISTENTES ===============
-- category_id precisa existir antes do backfill. A migration da Fase 4 tambem
-- declara a coluna com IF NOT EXISTS para manter compatibilidade em reexecucoes.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category_id uuid
  REFERENCES public.transaction_categories(id) ON DELETE SET NULL;

UPDATE public.transactions
SET category_id = (
  SELECT id FROM public.transaction_categories tc
  WHERE tc.code = CASE
    WHEN public.transactions.category = 'INCOME' THEN 'INCOME'
    WHEN public.transactions.category = 'FIXED' THEN 'FIXED'
    WHEN public.transactions.category = 'VARIABLE' THEN 'VARIABLE'
    WHEN public.transactions.category = 'INVESTMENT' THEN 'INVESTMENT'
    WHEN public.transactions.category = 'TAX' THEN 'TAX'
    WHEN public.transactions.category = 'TRANSFER' THEN 'TRANSFER'
    WHEN public.transactions.category = 'HOUSING' THEN 'HOUSING'
    WHEN public.transactions.category = 'GROCERIES' THEN 'GROCERIES'
    WHEN public.transactions.category = 'DINING_OUT' THEN 'DINING_OUT'
    WHEN public.transactions.category = 'TRANSPORT' THEN 'TRANSPORT'
    WHEN public.transactions.category = 'SHOPPING_ONLINE' THEN 'SHOPPING_ONLINE'
    WHEN public.transactions.category = 'ENTERTAINMENT' THEN 'ENTERTAINMENT'
    WHEN public.transactions.category = 'STOCKS' THEN 'STOCKS'
    WHEN public.transactions.category = 'FIIS' THEN 'FIIS'
    WHEN public.transactions.category = 'FIXED_INCOME' THEN 'FIXED_INCOME'
    WHEN public.transactions.category = 'IRPF' THEN 'IRPF'
    WHEN public.transactions.category = 'DARF' THEN 'DARF'
    WHEN public.transactions.category = 'TRANSFER_IN' THEN 'TRANSFER_IN'
    WHEN public.transactions.category = 'TRANSFER_OUT' THEN 'TRANSFER_OUT'
    ELSE 'other_unclassified'
  END
)
WHERE category_id IS NULL
  AND category IS NOT NULL;

-- =============== 8. INDEX ===============
CREATE INDEX IF NOT EXISTS idx_transaction_categories_parent_id ON public.transaction_categories(parent_id);
