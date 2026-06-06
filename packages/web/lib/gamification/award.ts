import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateBadges } from '@/lib/gamification/badges';

// Tabelas de gamification só aceitam escrita via service_role (RLS sem policy de
// cliente). Por isso todo o motor roda com o admin client.

type Db = ReturnType<typeof createAdminClient>;

// Pontos por acerto, conforme a odd (spec seção 7).
function pointsForOdds(odds: number): number {
  if (odds <= 1.5) return 2;
  if (odds <= 2.5) return 5;
  if (odds <= 5) return 10;
  if (odds <= 10) return 15;
  return 20;
}

// Créditos por acerto, conforme a odd (spec seção 7).
function creditsForOdds(odds: number): number {
  if (odds >= 10) return 3;
  if (odds >= 5) return 2;
  return 1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function bumpPoints(db: Db, userId: string, pts: number): Promise<void> {
  const { data } = await db
    .from('user_points')
    .select('total_points, points_from_correct_predictions')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) {
    await db
      .from('user_points')
      .update({
        total_points: data.total_points + pts,
        points_from_correct_predictions:
          (data.points_from_correct_predictions ?? 0) + pts,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } else {
    await db.from('user_points').insert({
      user_id: userId,
      total_points: pts,
      points_from_correct_predictions: pts,
    });
  }
}

async function bumpCredits(db: Db, userId: string, cr: number): Promise<void> {
  const { data } = await db
    .from('user_credits')
    .select('total_credits, credits_available')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) {
    await db
      .from('user_credits')
      .update({
        total_credits: data.total_credits + cr,
        credits_available: (data.credits_available ?? 0) + cr,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } else {
    await db.from('user_credits').insert({
      user_id: userId,
      total_credits: cr,
      credits_available: cr,
    });
  }
}

// Recalcula tipster_stats do zero a partir dos palpites resolvidos — simples e sem
// drift incremental.
async function recomputeTipsterStats(db: Db, tipsterId: string): Promise<void> {
  const { data } = await db
    .from('predictions')
    .select('status, odds, suggested_stake')
    .eq('tipster_id', tipsterId)
    .in('status', ['won', 'lost', 'voided']);
  const rows = (data ?? []).map((r) => ({
    status: r.status as string,
    odds: Number(r.odds),
    stake: Number(r.suggested_stake),
  }));

  const won = rows.filter((r) => r.status === 'won');
  const lost = rows.filter((r) => r.status === 'lost');
  const voided = rows.filter((r) => r.status === 'voided');
  const decided = won.length + lost.length; // anulados não entram no hit rate

  const hitRate = decided ? (won.length / decided) * 100 : 0;
  const avgOdds = rows.length
    ? rows.reduce((s, r) => s + r.odds, 0) / rows.length
    : 0;
  const profit =
    won.reduce((s, r) => s + r.stake * (r.odds - 1), 0) -
    lost.reduce((s, r) => s + r.stake, 0);
  const staked = [...won, ...lost].reduce((s, r) => s + r.stake, 0);
  const roi = staked ? (profit / staked) * 100 : 0;

  await db.from('tipster_stats').upsert(
    {
      tipster_id: tipsterId,
      total_predictions: rows.length,
      total_won: won.length,
      total_lost: lost.length,
      total_voided: voided.length,
      hit_rate: round2(hitRate),
      roi: round2(roi),
      average_odds: round2(avgOdds),
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: 'tipster_id' },
  );
}

/**
 * Aplica os efeitos de gamification de um palpite recém-resolvido:
 * concede pontos+créditos se for acerto (idempotente, uma vez por palpite) e
 * recalcula as stats do tipster. Chamado pelo markResult.
 *
 * Limitação conhecida (MVP): se o admin trocar o resultado depois (ex: won→lost),
 * os pontos/créditos já concedidos NÃO são estornados — só as stats recalculam.
 */
export async function applyPredictionResult(predictionId: string): Promise<void> {
  const db = createAdminClient();
  const { data: pred } = await db
    .from('predictions')
    .select('id, tipster_id, odds, status')
    .eq('id', predictionId)
    .single();
  if (!pred) return;

  if (pred.status === 'won') {
    // Idempotência: só concede se ainda não houver transação para este palpite.
    const { data: existing } = await db
      .from('point_transactions')
      .select('id')
      .eq('reference_id', predictionId)
      .eq('transaction_type', 'correct_prediction')
      .maybeSingle();

    if (!existing) {
      const odds = Number(pred.odds);
      const pts = pointsForOdds(odds);
      const cr = creditsForOdds(odds);
      await db.from('point_transactions').insert({
        user_id: pred.tipster_id,
        transaction_type: 'correct_prediction',
        amount: pts,
        reference_id: predictionId,
        reference_type: 'prediction',
        description: `Acerto (odds ${pred.odds})`,
      });
      await db.from('credit_transactions').insert({
        user_id: pred.tipster_id,
        transaction_type: 'earned_from_prediction',
        amount: cr,
        description: `Acerto (odds ${pred.odds})`,
      });
      await bumpPoints(db, pred.tipster_id, pts);
      await bumpCredits(db, pred.tipster_id, cr);
    }
  }

  await recomputeTipsterStats(db, pred.tipster_id);
  await evaluateBadges(db, pred.tipster_id);
}
