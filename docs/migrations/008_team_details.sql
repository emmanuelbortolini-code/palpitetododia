-- 008_team_details.sql
-- Detalhes editáveis dos times + vínculo time↔liga↔temporada (filtro da /admin/equipes).

-- Novas colunas (todas opcionais) na tabela teams.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS code varchar(10),
  ADD COLUMN IF NOT EXISTS founded int,
  ADD COLUMN IF NOT EXISTS venue_name varchar(150),
  ADD COLUMN IF NOT EXISTS venue_address varchar(255),
  ADD COLUMN IF NOT EXISTS venue_city varchar(120),
  ADD COLUMN IF NOT EXISTS venue_capacity int,
  ADD COLUMN IF NOT EXISTS website varchar(255);

-- Vínculo: qual time jogou qual liga em qual temporada.
CREATE TABLE IF NOT EXISTS public.team_leagues (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_leagues_uq UNIQUE (team_id, league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_team_leagues_league ON public.team_leagues(league_id);
CREATE INDEX IF NOT EXISTS idx_team_leagues_season ON public.team_leagues(season);

-- Só o servidor (service-role) acessa; nenhuma policy para anon/authenticated.
ALTER TABLE public.team_leagues ENABLE ROW LEVEL SECURITY;
