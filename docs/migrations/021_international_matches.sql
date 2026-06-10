-- 021_international_matches.sql
-- Histórico de jogos de SELEÇÕES (fonte ESPN: amistosos, eliminatórias, Nations League,
-- competições continentais) usado para semear o Elo internacional do modelo da Copa do
-- Mundo (que não tem jogos próprios antes do torneio). Uma linha por partida; o Elo é
-- recalculado on-the-fly a partir destas linhas (sem tabela de rating intermediária).

CREATE TABLE IF NOT EXISTS public.international_matches (
  espn_event_id text PRIMARY KEY,
  played_at timestamptz NOT NULL,
  home_espn_id text NOT NULL,
  away_espn_id text NOT NULL,
  home_goals integer NOT NULL,
  away_goals integer NOT NULL,
  neutral boolean NOT NULL DEFAULT false,
  competition text NOT NULL,            -- slug ESPN da competição
  importance integer NOT NULL DEFAULT 30, -- peso K do Elo conforme a competição
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS international_matches_played_idx
  ON public.international_matches (played_at);
