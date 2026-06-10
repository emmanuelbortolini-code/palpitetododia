-- 020_match_predictions.sql
-- Previsões pré-jogo persistidas (Poisson + Dixon-Coles por mando). Uma linha por
-- jogo: grava a probabilidade ENQUANTO o jogo está agendado (sem vazamento) e, quando
-- o jogo encerra, recebe o placar real (scoreFinished) para permitir calibração honesta
-- (Brier/log-loss comparando previsão pré-jogo vs resultado, acumulada ao longo do tempo).

CREATE TABLE IF NOT EXISTS public.match_predictions (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  season integer NOT NULL,
  predicted_at timestamptz NOT NULL DEFAULT now(),

  lambda_home numeric,
  lambda_away numeric,
  p_home numeric NOT NULL,
  p_draw numeric NOT NULL,
  p_away numeric NOT NULL,
  p_over25 numeric NOT NULL,
  p_btts numeric NOT NULL,
  top_home integer,
  top_away integer,

  -- preenchidos quando o jogo encerra (scoreFinished); nulos enquanto agendado.
  actual_home_score integer,
  actual_away_score integer,
  scored_at timestamptz
);

CREATE INDEX IF NOT EXISTS match_predictions_scored_idx
  ON public.match_predictions (scored_at)
  WHERE scored_at IS NOT NULL;
