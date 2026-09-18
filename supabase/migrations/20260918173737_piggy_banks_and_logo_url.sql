-- ============================================================================
-- Migration: Piggy Banks + Logo URL
-- Data: 2026-09-18
-- Descrição: Cria tabelas de cofrinho e movimentações, adiciona logo_url
--            em contas e cartões de crédito.
-- ============================================================================

-- 1. Tabela piggy_banks
CREATE TABLE public.piggy_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela piggy_bank_movements
CREATE TABLE public.piggy_bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piggy_bank_id UUID NOT NULL REFERENCES public.piggy_banks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'recurring', 'round_up', 'transfer')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices
CREATE INDEX idx_piggy_banks_user_id ON public.piggy_banks(user_id);
CREATE INDEX idx_piggy_bank_movements_piggy_bank_id ON public.piggy_bank_movements(piggy_bank_id);
CREATE INDEX idx_piggy_bank_movements_date ON public.piggy_bank_movements(date);

-- 4. RLS — piggy_banks
ALTER TABLE public.piggy_banks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.piggy_banks TO authenticated;
GRANT ALL ON public.piggy_banks TO service_role;

CREATE POLICY "piggy_banks_own" ON public.piggy_banks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. RLS — piggy_bank_movements (acesso via ownership do piggy_bank pai)
ALTER TABLE public.piggy_bank_movements ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.piggy_bank_movements TO authenticated;
GRANT ALL ON public.piggy_bank_movements TO service_role;

CREATE POLICY "piggy_bank_movements_own" ON public.piggy_bank_movements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.piggy_banks
      WHERE piggy_banks.id = piggy_bank_movements.piggy_bank_id
      AND piggy_banks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.piggy_banks
      WHERE piggy_banks.id = piggy_bank_movements.piggy_bank_id
      AND piggy_banks.user_id = auth.uid()
    )
  );

-- 6. Trigger para manter saldo do cofrinho sempre consistente
CREATE OR REPLACE FUNCTION public.update_piggy_bank_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'deposit' THEN
      UPDATE public.piggy_banks SET balance = balance + NEW.amount WHERE id = NEW.piggy_bank_id;
    ELSIF NEW.type = 'withdrawal' THEN
      UPDATE public.piggy_banks SET balance = balance - NEW.amount WHERE id = NEW.piggy_bank_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'deposit' THEN
      UPDATE public.piggy_banks SET balance = balance - OLD.amount WHERE id = OLD.piggy_bank_id;
    ELSIF OLD.type = 'withdrawal' THEN
      UPDATE public.piggy_banks SET balance = balance + OLD.amount WHERE id = OLD.piggy_bank_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_piggy_bank_balance
  AFTER INSERT OR DELETE ON public.piggy_bank_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_piggy_bank_balance();

-- 7. Adicionar logo_url em accounts
ALTER TABLE public.accounts ADD COLUMN logo_url TEXT;

-- 8. Adicionar logo_url em credit_cards
ALTER TABLE public.credit_cards ADD COLUMN logo_url TEXT;
