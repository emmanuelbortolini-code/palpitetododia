-- 017_team_season_stats.sql
-- Agregados do time na temporada (fonte ESPN: record + statistics). Uma linha por
-- time/liga/temporada, com totais e splits mandante/visitante (base para
-- probabilidade) + o blob bruto em `raw` (record.items + categorias de estatística).

CREATE TABLE IF NOT EXISTS public.team_season_stats (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season integer NOT NULL,

  rank integer,
  played integer,
  wins integer,
  draws integer,
  losses integer,
  points integer,
  gf integer,
  ga integer,
  gd integer,

  home_played integer,
  home_wins integer,
  home_draws integer,
  home_losses integer,
  home_gf integer,
  home_ga integer,

  away_played integer,
  away_wins integer,
  away_draws integer,
  away_losses integer,
  away_gf integer,
  away_ga integer,

  clean_sheets integer,

  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (team_id, league_id, season)
);
