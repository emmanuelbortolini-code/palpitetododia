-- 013_league_curate.sql
-- Curadoria e dedupe de ligas (espelha o modelo de teams):
--   * merged_into: a versão ESPN de uma competição aponta para a versão
--     API-Football (canônica). Vínculos time↔liga e filtros usam a canônica.
--   * curated: marca as competições que mantemos visíveis (o resto — U20,
--     feminino, copas regionais — fica curated=false, escondido, sem apagar).

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leagues_merged_into ON public.leagues(merged_into);
CREATE INDEX IF NOT EXISTS idx_leagues_curated ON public.leagues(curated) WHERE curated;
