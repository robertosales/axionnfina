-- Categorias personalizadas por usuario, sem alterar o catalogo do sistema.
ALTER TABLE public.transaction_categories
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS transaction_categories_user_name_kind_idx
  ON public.transaction_categories (user_id, lower(COALESCE(name, label)), kind)
  WHERE user_id IS NOT NULL;

GRANT INSERT, UPDATE ON public.transaction_categories TO authenticated;

DROP POLICY IF EXISTS categories_user_insert ON public.transaction_categories;
CREATE POLICY categories_user_insert ON public.transaction_categories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS categories_user_update ON public.transaction_categories;
CREATE POLICY categories_user_update ON public.transaction_categories
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS categories_user_delete ON public.transaction_categories;
CREATE POLICY categories_user_delete ON public.transaction_categories
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_system = false);
