-- ============================================================================
-- Migration: Piggy Bank Edit, Delete & Transfer
-- Data: 2026-09-19
-- Descrição: RPCs para editar, excluir e transferir saldo entre cofrinhos.
-- ============================================================================

-- 1. Atualizar cofrinho (nome, ícone, cor)
CREATE OR REPLACE FUNCTION public.update_piggy_bank(
  p_piggy_bank_id UUID,
  p_name TEXT,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
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
  SET name = p_name, icon = p_icon, color = p_color
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;
END;
$$;

-- 2. Excluir cofrinho (exige saldo = 0)
CREATE OR REPLACE FUNCTION public.delete_piggy_bank(
  p_piggy_bank_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC(15,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT balance INTO v_balance
  FROM public.piggy_banks
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;
  IF v_balance != 0 THEN
    RAISE EXCEPTION 'Saldo deve ser zero para excluir. Transfira ou resgate o valor primeiro.';
  END IF;

  DELETE FROM public.piggy_banks
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;
END;
$$;

-- 3. Transferir saldo entre cofrinhos
CREATE OR REPLACE FUNCTION public.transfer_piggy_bank(
  p_from_id UUID,
  p_to_id UUID,
  p_amount NUMERIC(15,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_from_balance NUMERIC(15,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT balance INTO v_from_balance
  FROM public.piggy_banks
  WHERE id = p_from_id AND user_id = v_user_id;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Cofrinho de origem não encontrado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.piggy_banks
    WHERE id = p_to_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Cofrinho de destino não encontrado';
  END IF;
  IF p_from_id = p_to_id THEN
    RAISE EXCEPTION 'Cofrinhos devem ser diferentes';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente no cofrinho de origem';
  END IF;

  INSERT INTO public.piggy_bank_movements (piggy_bank_id, type, amount, note)
  VALUES (p_from_id, 'withdrawal', p_amount, 'Transferência entre cofrinhos');

  INSERT INTO public.piggy_bank_movements (piggy_bank_id, type, amount, note)
  VALUES (p_to_id, 'deposit', p_amount, 'Transferência entre cofrinhos');
END;
$$;
