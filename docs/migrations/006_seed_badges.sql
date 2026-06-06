-- Migration 006 — definições das badges (tabela de referência, leitura pública).
-- criteria_json é descritivo; a avaliação real fica em lib/gamification/badges.ts
-- (referenciada por `code`). Idempotente: pode rodar de novo sem duplicar.
-- Badges de follower (Popular/Influencer) virão quando existir "seguir tipster".

INSERT INTO public.badges (code, name, description, criteria_json, tier) VALUES
  ('first_prediction', 'Primeiro Palpite', 'Teve seu primeiro palpite resolvido',
   '{"type":"total_predictions","min":1}', 'bronze'),
  ('first_win', 'Primeira Vitória', 'Acertou seu primeiro palpite',
   '{"type":"total_won","min":1}', 'bronze'),
  ('expert', 'Expert', '60% de acerto com ao menos 10 palpites',
   '{"type":"hit_rate","min":60,"min_predictions":10}', 'silver'),
  ('master', 'Mestre', '70% de acerto com ao menos 10 palpites',
   '{"type":"hit_rate","min":70,"min_predictions":10}', 'gold'),
  ('legend', 'Lenda', '80% de acerto com ao menos 10 palpites',
   '{"type":"hit_rate","min":80,"min_predictions":10}', 'gold'),
  ('wins_100', '100 Vitórias', 'Acertou 100 palpites',
   '{"type":"total_won","min":100}', 'silver'),
  ('wins_500', '500 Vitórias', 'Acertou 500 palpites',
   '{"type":"total_won","min":500}', 'gold')
ON CONFLICT (code) DO NOTHING;
