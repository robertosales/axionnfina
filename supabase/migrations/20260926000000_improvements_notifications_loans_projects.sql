-- ============================================================
-- Melhorias Fase 1-4: notificações, tags, empréstimos, projetos
-- Execute pelo Lovable (Supabase). NÃO marcada como validada
-- até retorno da execução.
-- ============================================================

-- =============== TRANSACTIONS TAGS ===============
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_transactions_tags ON public.transactions USING gin (tags);

-- =============== NOTIFICATIONS ===============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('budget_warning','budget_over','bill_overdue','bill_due_soon','insight')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

-- =============== LOANS ===============
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  principal numeric(14,2) NOT NULL CHECK (principal > 0),
  interest_rate numeric(6,3) NOT NULL DEFAULT 0,
  installment numeric(14,2) NOT NULL CHECK (installment > 0),
  remaining numeric(14,2) NOT NULL DEFAULT 0,
  total_paid numeric(14,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','overdue')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loans_own ON public.loans;
CREATE POLICY loans_own ON public.loans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS loans_updated_at ON public.loans;
CREATE TRIGGER loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loans(user_id, status, due_date);

-- =============== PROJECTS ===============
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  target numeric(14,2) NOT NULL CHECK (target > 0),
  current numeric(14,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Outros',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_own ON public.projects;
CREATE POLICY projects_own ON public.projects
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id, status, end_date);
