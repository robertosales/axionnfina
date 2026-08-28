-- ============================================================
-- FASES 3/4: hardening de conexoes, idempotencia e ledger
-- Migration aditiva para ambientes que ja aplicaram as fases anteriores.
-- ============================================================

ALTER TABLE public.account_connections
  ADD COLUMN IF NOT EXISTS consent_status public.consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS consent_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text;

CREATE INDEX IF NOT EXISTS idx_account_connections_consent_expiry
  ON public.account_connections(user_id, consent_expires_at)
  WHERE consent_status = 'authorised';

-- Uma transacao normalizada so pode apontar uma vez para o mesmo evento bruto.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_external_transaction
  ON public.transactions(external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;

-- Cada conta financeira possui no maximo uma conta contabil ativa vinculada.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_active_financial_account
  ON public.ledger_accounts(user_id, account_id)
  WHERE account_id IS NOT NULL AND is_active = true;

DO $$ BEGIN
  ALTER TABLE public.ledger_accounts
    ADD CONSTRAINT ledger_accounts_type_check
    CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.journal_lines
    ADD CONSTRAINT journal_lines_positive_amount_check CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.transaction_enrichments
    ADD CONSTRAINT transaction_enrichments_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.transaction_pairs
    ADD CONSTRAINT transaction_pairs_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Evita que o cliente marque como processado um evento que falhou. O pipeline
-- passa a preencher processed_at apenas depois da normalizacao bem-sucedida.
CREATE INDEX IF NOT EXISTS idx_external_transactions_retry
  ON public.external_transactions(connection_id, account_id, posted_at)
  WHERE processed_at IS NULL;

