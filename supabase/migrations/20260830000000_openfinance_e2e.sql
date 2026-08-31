-- Allow idempotent refreshes of the provider's raw transaction mirror.
GRANT UPDATE ON public.external_transactions TO authenticated;
GRANT DELETE ON public.external_transactions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_account_connections_provider_item
  ON public.account_connections
  USING gin (metadata jsonb_path_ops);
