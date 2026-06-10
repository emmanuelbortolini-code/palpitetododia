-- 019_player_season_stats.sql
-- Estatísticas por jogador na temporada (fonte ESPN: leaders da competição).
-- Uma linha por jogador/liga/temporada, com gols/assistências e demais contagens.

CREATE TABLE IF NOT EXISTS public.player_season_stats (
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season integer NOT NULL,
  espn_athlete_id text NOT NULL,

  player_name text,
  position text,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,

  goals integer,
  assists integer,
  shots integer,
  shots_on_target integer,
  yellow integer,
  red integer,
  fouls integer,
  saves integer,

  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (league_id, season, espn_athlete_id)
);
