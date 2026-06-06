import { z } from 'zod';

// Espelha as constraints do SQL (tabela predictions):
// confidence 1..100, odds > 1 e < 1000, suggested_stake > 0.
export const predictionSchema = z.object({
  match_id: z.string().uuid('Selecione uma partida'),
  prediction_type: z.enum([
    'winner',
    'over_under',
    'both_score',
    'exact_score',
    'first_goal',
    'handicap',
    'draw_no_bet',
    'double_chance',
  ]),
  prediction_value: z.string().min(1, 'Informe o palpite').max(100),
  confidence: z.coerce
    .number()
    .int()
    .min(1, 'Mínimo 1')
    .max(100, 'Máximo 100'),
  odds: z.coerce
    .number()
    .gt(1, 'Odds deve ser maior que 1')
    .lt(1000, 'Odds deve ser menor que 1000'),
  suggested_stake: z.coerce.number().gt(0, 'Stake deve ser maior que 0'),
  description: z.string().max(2000).optional(),
  tag_name: z.string().max(50).optional(),
});

export type PredictionInput = z.infer<typeof predictionSchema>;

export const PREDICTION_TYPE_LABELS: Record<string, string> = {
  winner: 'Vencedor',
  over_under: 'Over/Under',
  both_score: 'Ambas marcam',
  exact_score: 'Placar exato',
  first_goal: 'Primeiro a marcar',
  handicap: 'Handicap',
  draw_no_bet: 'Empate anula',
  double_chance: 'Dupla chance',
};
