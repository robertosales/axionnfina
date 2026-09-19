-- ============================================================================
-- Migration: Institutions Logo URL
-- Data: 2026-09-19
-- Descrição: Adiciona coluna logo_url à tabela institutions e popula com
--            URLs oficiais da CDN logos-bancos-br via jsDelivr.
-- ============================================================================

-- 1. Adicionar coluna logo_url
ALTER TABLE public.institutions ADD COLUMN logo_url text;

-- 2. Popular logos das 20 principais instituições usando CDN logos-bancos-br
UPDATE public.institutions SET logo_url = CASE code
  WHEN '001' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00000000.svg'
  WHEN '033' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/90400888.svg'
  WHEN '077' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00416968.svg'
  WHEN '104' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00360305.svg'
  WHEN '208' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/30306294.svg'
  WHEN '237' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/60746948.svg'
  WHEN '260' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/18236120.svg'
  WHEN '290' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/08561701.svg'
  WHEN '323' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/10573521.svg'
  WHEN '341' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/60701190.svg'
  WHEN '380' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/22896431.svg'
  WHEN '102' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/02332886.svg'
  WHEN '336' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/31872495.svg'
  WHEN '655' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/59588111.svg'
  WHEN '623' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/59285411.svg'
  WHEN '756' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/02038232.svg'
  WHEN '748' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/01181521.svg'
  WHEN '041' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/92702067.svg'
  WHEN '422' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/58160789.svg'
  ELSE logo_url
END;
