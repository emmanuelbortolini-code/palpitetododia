-- 012_team_provider_snapshot.sql
-- Snapshot bruto de cada fonte, separado dos dados editáveis ("Dados Atuais").
-- As abas "Dados ESPN" / "Dados Football API" da tela de editar leem daqui — assim
-- o dado original da API continua visível mesmo depois de uma edição manual.
-- Convenção: a linha que carrega api_football_id guarda api_football_data; a que
-- carrega espn_id guarda espn_data. Populado pelo sync/backfill, nunca editado à mão.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS api_football_data jsonb,
  ADD COLUMN IF NOT EXISTS espn_data jsonb;
