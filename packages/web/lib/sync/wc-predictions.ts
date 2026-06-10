import { createAdminClient } from '@/lib/supabase/admin';
import { computeElo, eloMatchProbabilities } from '@/lib/elo';
import { loadIntlHistory } from '@/lib/intl-history';

const SEASON = 2026;

/**
 * Grava a previsão pré-jogo (modelo Elo de seleções) dos jogos AGENDADOS da Copa em
 * match_predictions. A pontuação (placar real) é feita pelo passo global de syncPredictions,
 * que pontua qualquer previsão cujo jogo encerrou — então aqui só geramos as previsões.
 */
export async function syncWcPredictions(): Promise<{ predicted: number }> {
  const supabase = createAdminClient();
  const { data: league } = await supabase.from('leagues').select('id').eq('slug', 'copa-do-mundo-fifa').maybeSingle();
  if (!league) return { predicted: 0 };

  const elo = computeElo(await loadIntlHistory(supabase));
  const ratingOf = (espnId: string | null | undefined) => (espnId ? elo.get(String(espnId))?.rating ?? 1500 : 1500);

  const { data: matches } = await supabase
    .from('matches')
    .select('id, home:home_team_id(espn_id), away:away_team_id(espn_id)')
    .eq('league_id', league.id)
    .eq('status', 'scheduled');

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const m of matches ?? []) {
    const rh = ratingOf((m.home as unknown as { espn_id: string | null } | null)?.espn_id);
    const ra = ratingOf((m.away as unknown as { espn_id: string | null } | null)?.espn_id);
    const p = eloMatchProbabilities(rh, ra);
    rows.push({
      match_id: m.id,
      league_id: league.id,
      season: SEASON,
      predicted_at: now,
      lambda_home: p.lambdaHome,
      lambda_away: p.lambdaAway,
      p_home: p.homeWin,
      p_draw: p.draw,
      p_away: p.awayWin,
      p_over25: p.over25,
      p_btts: p.btts,
      top_home: p.topScore.home,
      top_away: p.topScore.away,
    });
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('match_predictions').upsert(rows.slice(i, i + 200), { onConflict: 'match_id' });
    if (error) throw new Error(`upsert previsões Copa: ${error.message}`);
  }
  return { predicted: rows.length };
}
