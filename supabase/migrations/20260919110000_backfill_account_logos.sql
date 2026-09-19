-- ============================================================================
-- Migration: Backfill accounts.logo_url
-- Data: 2026-09-19
-- Descrição: Preenche accounts.logo_url a partir de institutions.logo_url
--            para contas que não possuem logo definida.
-- ============================================================================

UPDATE public.accounts a
SET logo_url = i.logo_url
FROM public.institutions i
WHERE a.institution_id = i.id
  AND a.logo_url IS NULL
  AND i.logo_url IS NOT NULL;
