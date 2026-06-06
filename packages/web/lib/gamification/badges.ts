import { createAdminClient } from '@/lib/supabase/admin';

type Db = ReturnType<typeof createAdminClient>;

type Stats = { total_predictions: number; total_won: number; hit_rate: number };

// Regras de concessão por `code` (devem casar com os codes da migration 006).
// Avaliadas sobre tipster_stats — recalculadas a cada resultado.
const RULES: { code: string; earned: (s: Stats) => boolean }[] = [
  { code: 'first_prediction', earned: (s) => s.total_predictions >= 1 },
  { code: 'first_win', earned: (s) => s.total_won >= 1 },
  { code: 'expert', earned: (s) => s.total_predictions >= 10 && s.hit_rate >= 60 },
  { code: 'master', earned: (s) => s.total_predictions >= 10 && s.hit_rate >= 70 },
  { code: 'legend', earned: (s) => s.total_predictions >= 10 && s.hit_rate >= 80 },
  { code: 'wins_100', earned: (s) => s.total_won >= 100 },
  { code: 'wins_500', earned: (s) => s.total_won >= 500 },
];

/**
 * Concede ao tipster as badges que ele já cumpre e ainda não possui (idempotente).
 * Roda dentro do applyPredictionResult, após recalcular as stats.
 */
export async function evaluateBadges(db: Db, tipsterId: string): Promise<void> {
  const { data: stats } = await db
    .from('tipster_stats')
    .select('total_predictions, total_won, hit_rate')
    .eq('tipster_id', tipsterId)
    .maybeSingle();
  if (!stats) return;

  const s: Stats = {
    total_predictions: stats.total_predictions ?? 0,
    total_won: stats.total_won ?? 0,
    hit_rate: Number(stats.hit_rate ?? 0),
  };
  const earnedCodes = RULES.filter((r) => r.earned(s)).map((r) => r.code);
  if (!earnedCodes.length) return;

  // codes -> ids (se a migration 006 ainda não rodou, retorna vazio: no-op seguro).
  const { data: badges } = await db
    .from('badges')
    .select('id, code')
    .in('code', earnedCodes);
  if (!badges?.length) return;

  const { data: existing } = await db
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', tipsterId);
  const have = new Set((existing ?? []).map((e) => e.badge_id));

  const toInsert = badges
    .filter((b) => !have.has(b.id))
    .map((b) => ({ user_id: tipsterId, badge_id: b.id }));
  if (toInsert.length) {
    await db.from('user_badges').insert(toInsert);
  }
}
