-- Central de Inteligência Financeira: campos necessários para histórico confiável.
-- Esta migration não inventa dados retroativos; novos snapshots passam a guardar o limite vigente.

ALTER TABLE public.account_balances
  ADD COLUMN IF NOT EXISTS credit_limit numeric(15,2),
  ADD COLUMN IF NOT EXISTS overdraft_rate_monthly numeric(8,4);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS overdraft_rate_monthly numeric(8,4)
    CHECK (overdraft_rate_monthly IS NULL OR overdraft_rate_monthly >= 0);

ALTER TABLE public.credit_card_invoice_items
  ADD COLUMN IF NOT EXISTS installment_number integer
    CHECK (installment_number IS NULL OR installment_number > 0),
  ADD COLUMN IF NOT EXISTS installment_count integer
    CHECK (installment_count IS NULL OR installment_count > 0),
  ADD CONSTRAINT credit_card_invoice_items_installment_order_check
    CHECK (installment_number IS NULL OR installment_count IS NULL OR installment_number <= installment_count);

-- Preenche somente formatos inequívocos como "3/12". Outros valores permanecem nulos.
UPDATE public.credit_card_invoice_items
SET installment_number = split_part(installment, '/', 1)::integer,
    installment_count = split_part(installment, '/', 2)::integer
WHERE installment ~ '^[0-9]+/[0-9]+$'
  AND installment_number IS NULL
  AND installment_count IS NULL;

CREATE OR REPLACE FUNCTION public.capture_account_balance_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_balances (
    user_id, account_id, balance, available_balance, snapshot_date,
    source, credit_limit, overdraft_rate_monthly
  ) VALUES (
    NEW.user_id, NEW.id, NEW.balance, NEW.available_balance, CURRENT_DATE,
    CASE WHEN NEW.open_finance THEN 'open_finance' ELSE 'manual' END,
    NEW.credit_limit, NEW.overdraft_rate_monthly
  )
  ON CONFLICT (account_id, snapshot_date)
  DO UPDATE SET
    balance = EXCLUDED.balance,
    available_balance = EXCLUDED.available_balance,
    source = EXCLUDED.source,
    credit_limit = EXCLUDED.credit_limit,
    overdraft_rate_monthly = EXCLUDED.overdraft_rate_monthly;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_account_balance_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_account_balance_snapshot() TO authenticated, service_role;

COMMENT ON COLUMN public.account_balances.credit_limit IS 'Limite vigente na data do snapshot; nulo para históricos anteriores sem evidência.';
COMMENT ON COLUMN public.accounts.overdraft_rate_monthly IS 'Taxa mensal opcional usada apenas para estimativas informativas de juros.';
COMMENT ON COLUMN public.credit_card_invoice_items.installment_number IS 'Número estruturado da parcela, quando informado pela origem.';
COMMENT ON COLUMN public.credit_card_invoice_items.installment_count IS 'Quantidade total de parcelas, quando informada pela origem.';
