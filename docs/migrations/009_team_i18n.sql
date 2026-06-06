-- 009_team_i18n.sql
-- Campos multilíngues e extras das equipes, conforme o CSV de referência
-- (#dados/brazil-serie-a-2026-teams.csv): nomes/slugs EN/ES, apelidos por idioma, gênero.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS name_en varchar(150),
  ADD COLUMN IF NOT EXISTS name_es varchar(150),
  ADD COLUMN IF NOT EXISTS slug_en varchar(150),
  ADD COLUMN IF NOT EXISTS slug_es varchar(150),
  ADD COLUMN IF NOT EXISTS nicknames_pt jsonb,
  ADD COLUMN IF NOT EXISTS nicknames_en jsonb,
  ADD COLUMN IF NOT EXISTS nicknames_es jsonb,
  ADD COLUMN IF NOT EXISTS gender varchar(10);

-- Fonte 'csv' para times/ligas importados de planilha (além de api_football/espn).
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_external_api_source_check;
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_external_api_source_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_external_api_source_check
  CHECK (external_api_source IN ('api_football', 'espn', 'csv'));
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_external_api_source_check
  CHECK (external_api_source IN ('api_football', 'espn', 'csv'));
