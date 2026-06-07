-- 015_league_provider_snapshot.sql
-- Snapshot bruto de cada fonte para as ligas (abas Dados ESPN / Dados Football
-- API na edição). Convenção: a linha com external_api_source='api_football'
-- guarda api_football_data; a com 'espn' guarda espn_data.
--   api_football_data: { name, type, logo, country, seasons:[{year,current}] }
--   espn_data:         { name, slug, logo, season:{year}, teams:[{id,name,logo}] }

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS api_football_data jsonb,
  ADD COLUMN IF NOT EXISTS espn_data jsonb;
