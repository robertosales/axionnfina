-- Corrige transações Open Finance antigas que foram gravadas antes da origem ser explícita.
-- A atualização dispara a reversão de qualquer delta indevidamente aplicado pelo trigger de saldo.
UPDATE public.transactions
SET record_origin = 'open_finance'
WHERE record_origin <> 'open_finance'
  AND external_transaction_id IS NOT NULL;

-- Reestabelece o saldo autoritativo quando o provedor enviou balance_after
-- no payload bruto da última movimentação da conta.
WITH latest_provider_balance AS (
  SELECT DISTINCT ON (et.account_id)
    et.account_id,
    (et.raw_data->>'balance')::numeric AS balance
  FROM public.external_transactions et
  WHERE et.raw_data ? 'balance'
    AND (et.raw_data->>'balance') ~ '^-?[0-9]+(\\.[0-9]+)?$'
  ORDER BY et.account_id, et.posted_at DESC
)
UPDATE public.accounts account
SET balance = latest.balance,
    current_balance = latest.balance,
    updated_at = now()
FROM latest_provider_balance latest
WHERE account.id = latest.account_id;

-- Garante que novas linhas externas nunca sejam classificadas como manuais.
CREATE OR REPLACE FUNCTION public.sync_transaction_origin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.external_transaction_id IS NOT NULL THEN
    NEW.record_origin := 'open_finance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_sync_origin ON public.transactions;
CREATE TRIGGER transactions_sync_origin
BEFORE INSERT OR UPDATE OF external_transaction_id ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_origin();
