-- ============================================================================
-- Migration: Piggy Bank RPCs
-- Data: 2026-09-18
-- Descrição: Funções RPC para operações de cofrinho (criar, aportar, resgatar,
--            arquivar, encerrar) com impacto no saldo da conta vinculada.
-- ============================================================================

-- 1. Criar cofrinho
CREATE OR REPLACE FUNCTION public.create_piggy_bank(
  p_name TEXT,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_goal_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.piggy_banks (user_id, name, icon, color, goal_id)
  VALUES (v_user_id, p_name, p_icon, p_color, p_goal_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 2. Aportar ao cofrinho (subtrai da conta, adiciona ao cofrinho)
CREATE OR REPLACE FUNCTION public.deposit_to_piggy_bank(
  p_piggy_bank_id UUID,
  p_amount NUMERIC(15,2),
  p_account_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bank_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verificar ownership do cofrinho
  SELECT user_id INTO v_bank_user_id
  FROM public.piggy_banks
  WHERE id = p_piggy_bank_id;

  IF v_bank_user_id IS NULL THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;
  IF v_bank_user_id != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  -- Verificar saldo da conta
  IF EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = v_user_id AND balance < p_amount
  ) THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta';
  END IF;

  -- Subtrair da conta
  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_account_id AND user_id = v_user_id;

  -- Inserir movimentação (o trigger atualiza o saldo do cofrinho)
  INSERT INTO public.piggy_bank_movements (piggy_bank_id, type, amount, note)
  VALUES (p_piggy_bank_id, 'deposit', p_amount, p_note);
END;
$$;

-- 3. Resgatar do cofrinho (adiciona na conta, subtrai do cofrinho)
CREATE OR REPLACE FUNCTION public.withdraw_from_piggy_bank(
  p_piggy_bank_id UUID,
  p_amount NUMERIC(15,2),
  p_account_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bank_user_id UUID;
  v_current_balance NUMERIC(15,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verificar ownership do cofrinho
  SELECT user_id, balance INTO v_bank_user_id, v_current_balance
  FROM public.piggy_banks
  WHERE id = p_piggy_bank_id;

  IF v_bank_user_id IS NULL THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;
  IF v_bank_user_id != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente no cofrinho';
  END IF;

  -- Adicionar na conta
  UPDATE public.accounts
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_account_id AND user_id = v_user_id;

  -- Inserir movimentação (o trigger atualiza o saldo do cofrinho)
  INSERT INTO public.piggy_bank_movements (piggy_bank_id, type, amount, note)
  VALUES (p_piggy_bank_id, 'withdrawal', p_amount, p_note);
END;
$$;

-- 4. Arquivar cofrinho (só permite se saldo = 0)
CREATE OR REPLACE FUNCTION public.archive_piggy_bank(
  p_piggy_bank_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.piggy_banks
    WHERE id = p_piggy_bank_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;

  UPDATE public.piggy_banks
  SET status = 'archived'
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;
END;
$$;

-- 5. Encerrar cofrinho (exige saldo = 0, fecha permanentemente)
CREATE OR REPLACE FUNCTION public.close_piggy_bank(
  p_piggy_bank_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance NUMERIC(15,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.piggy_banks
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;
  IF v_current_balance != 0 THEN
    RAISE EXCEPTION 'Saldo do cofrinho deve ser zero para encerrar. Faça o resgate total antes.';
  END IF;

  UPDATE public.piggy_banks
  SET status = 'closed'
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;
END;
$$;

-- 6. Desarquivar cofrinho
CREATE OR REPLACE FUNCTION public.unarchive_piggy_bank(
  p_piggy_bank_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.piggy_banks
  SET status = 'active'
  WHERE id = p_piggy_bank_id AND user_id = v_user_id AND status = 'archived';
END;
$$;
