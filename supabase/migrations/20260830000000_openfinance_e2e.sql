-- Allow idempotent refreshes of the provider's raw transaction mirror.
GRANT UPDATE ON public.external_transactions TO authenticated;
GRANT DELETE ON public.external_transactions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_account_connections_provider_item
  ON public.account_connections
  USING gin (metadata jsonb_path_ops);

INSERT INTO public.institutions (
  code,
  name,
  short_name,
  logo_color,
  openfinance_participant
) VALUES (
  'pluggy-sandbox',
  'Pluggy Bank',
  'Sandbox',
  '#6366f1',
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  logo_color = EXCLUDED.logo_color,
  openfinance_participant = true;
