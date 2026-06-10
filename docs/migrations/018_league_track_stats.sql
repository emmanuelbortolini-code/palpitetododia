-- 018_league_track_stats.sql
-- Marca quais competições têm estatísticas de temporada sincronizadas
-- (team_season_stats), independente de a liga estar "ativa" (curated). Permite
-- puxar dados de copas (ex.: Copa do Brasil) sem ativá-las nas telas de admin.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS track_stats boolean NOT NULL DEFAULT false;

-- Competições rastreadas no momento: Brasileirão Série A (AF 71) e Copa do Brasil (AF 73).
UPDATE public.leagues
  SET track_stats = true
  WHERE external_api_source = 'api_football'
    AND external_api_id IN ('71', '73')
    AND merged_into IS NULL;
