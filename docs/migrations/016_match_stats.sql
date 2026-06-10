-- 016_match_stats.sql
-- Estatísticas por jogo (fonte ESPN: boxscore do summary). Uma linha por partida,
-- com colunas numéricas mandante/visitante (para agregação/probabilidade) + o blob
-- bruto em `raw` (todas as estatísticas para exibir).

CREATE TABLE IF NOT EXISTS public.match_stats (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,

  home_possession numeric(5, 1),
  away_possession numeric(5, 1),
  home_shots integer,
  away_shots integer,
  home_shots_on_target integer,
  away_shots_on_target integer,
  home_corners integer,
  away_corners integer,
  home_fouls integer,
  away_fouls integer,
  home_yellow integer,
  away_yellow integer,
  home_red integer,
  away_red integer,
  home_offsides integer,
  away_offsides integer,
  home_saves integer,
  away_saves integer,

  attendance integer,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
