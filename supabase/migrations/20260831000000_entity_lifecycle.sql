-- Axionn Finance: ciclo de vida uniforme para entidades gerenciaveis.
-- Arquivamento e reversivel; exclusao fisica continua restrita pela camada de dominio.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounts',
    'transactions',
    'budgets',
    'goals',
    'investment_positions',
    'payables',
    'receivables',
    'tax_events',
    'agent_insights',
    'agent_conversations'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS archived_at timestamptz',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS record_origin text NOT NULL DEFAULT ''manual''',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      table_name,
      table_name || '_record_origin_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (record_origin IN (''manual'', ''open_finance'', ''import'', ''system''))',
      table_name,
      table_name || '_record_origin_check'
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, archived_at)',
      'idx_' || table_name || '_user_archived',
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.protect_synchronized_record_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND OLD.record_origin <> 'manual' THEN
    RAISE EXCEPTION 'Registros sincronizados ou gerados pelo sistema devem ser arquivados, nao excluidos.'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DO $$
DECLARE
  table_name text;
  trigger_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounts',
    'transactions',
    'budgets',
    'goals',
    'investment_positions',
    'payables',
    'receivables',
    'tax_events',
    'agent_insights',
    'agent_conversations'
  ]
  LOOP
    trigger_name := 'protect_' || table_name || '_deletion';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_synchronized_record_deletion()',
      trigger_name,
      table_name
    );
  END LOOP;
END $$;

UPDATE public.accounts
SET archived_at = COALESCE(archived_at, updated_at),
    archived_by = COALESCE(archived_by, user_id)
WHERE is_archived = true;

UPDATE public.accounts
SET record_origin = CASE WHEN is_manual THEN 'manual' ELSE 'open_finance' END;

UPDATE public.transactions
SET record_origin = CASE
  WHEN external_id IS NOT NULL OR external_transaction_id IS NOT NULL THEN 'open_finance'
  ELSE 'manual'
END;

UPDATE public.investment_positions AS position
SET record_origin = CASE
  WHEN account.is_manual = false THEN 'open_finance'
  ELSE 'manual'
END
FROM public.accounts AS account
WHERE account.id = position.account_id;

UPDATE public.agent_insights SET record_origin = 'system';

CREATE OR REPLACE FUNCTION public.set_lifecycle_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    NEW.archived_by := CASE WHEN NEW.archived_at IS NULL THEN NULL ELSE auth.uid() END;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  trigger_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounts',
    'transactions',
    'budgets',
    'goals',
    'investment_positions',
    'payables',
    'receivables',
    'tax_events',
    'agent_insights',
    'agent_conversations'
  ]
  LOOP
    trigger_name := 'set_' || table_name || '_lifecycle_actor';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OF archived_at ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_lifecycle_actor()',
      trigger_name,
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_account_archive_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    NEW.archived_at := CASE WHEN NEW.is_archived THEN COALESCE(NEW.archived_at, now()) ELSE NULL END;
    NEW.archived_by := CASE WHEN NEW.is_archived THEN auth.uid() ELSE NULL END;
  ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    NEW.is_archived := NEW.archived_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_account_archive_state ON public.accounts;
CREATE TRIGGER sync_account_archive_state
BEFORE UPDATE OF is_archived, archived_at ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_account_archive_state();

-- Completa a auditoria das entidades que passam a aceitar mutacoes manuais.
DO $$
DECLARE
  table_name text;
  trigger_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounts',
    'budgets',
    'investment_positions',
    'receivables',
    'tax_events',
    'agent_insights',
    'agent_conversations'
  ]
  LOOP
    trigger_name := 'audit_' || table_name;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = trigger_name
        AND tgrelid = format('public.%I', table_name)::regclass
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()',
        trigger_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;
