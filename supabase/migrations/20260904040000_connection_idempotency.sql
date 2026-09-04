-- Evita conexoes ativas duplicadas para a mesma instituicao por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS account_connections_one_active_per_institution
  ON public.account_connections (user_id, institution_id)
  WHERE status IN ('active', 'pending', 'error');

-- O estado detalhado do provedor fica em metadata; nunca em segredo/token.
ALTER TABLE public.account_connections
  ADD COLUMN IF NOT EXISTS last_error_code text;

ALTER TABLE public.account_connections
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
