-- 010_team_canonical.sql
-- Identidade de teams por provedor: cada fonte tem sua coluna de id
-- (api_football_id, espn_id) no lugar do par (external_api_source,
-- external_api_id), para o mesmo clube poder carregar os dois ids.
-- `overrides` guarda os campos editados à mão (o sync nunca sobrescreve esses).

-- 1. Novas colunas.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS api_football_id varchar(100),
  ADD COLUMN IF NOT EXISTS espn_id varchar(100),
  ADD COLUMN IF NOT EXISTS overrides jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill a partir do par antigo (cada linha tem só uma fonte hoje).
UPDATE public.teams SET api_football_id = external_api_id
  WHERE external_api_source = 'api_football' AND external_api_id IS NOT NULL;
UPDATE public.teams SET espn_id = external_api_id
  WHERE external_api_source = 'espn' AND external_api_id IS NOT NULL;

-- 3. Unicidade por provedor (parcial: ignora NULL).
CREATE UNIQUE INDEX IF NOT EXISTS teams_api_football_id_uq
  ON public.teams (api_football_id) WHERE api_football_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teams_espn_id_uq
  ON public.teams (espn_id) WHERE espn_id IS NOT NULL;

-- 4. Remove o modelo antigo de identidade em teams (constraint + colunas).
--    Ligas e matches continuam com external_api_source/id próprios.
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_external_api_uq;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_external_api_source_check;
ALTER TABLE public.teams DROP COLUMN IF EXISTS external_api_source;
ALTER TABLE public.teams DROP COLUMN IF EXISTS external_api_id;
