export type PredictionType =
  | 'winner'
  | 'over_under'
  | 'both_score'
  | 'exact_score'
  | 'first_goal'
  | 'handicap'
  | 'draw_no_bet'
  | 'double_chance';

export type PredictionStatus =
  | 'draft'
  | 'published'
  | 'pending_result'
  | 'won'
  | 'lost'
  | 'voided'
  | 'rejected';

export interface Prediction {
  id: string;
  match_id: string;
  tipster_id: string;
  prediction_type: PredictionType;
  prediction_value: string;
  confidence: number;
  odds: number;
  suggested_stake: number;
  status: PredictionStatus;
  description: string | null;
  tag_name: string | null;
  result_marked_at: string | null;
  result_marked_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}
