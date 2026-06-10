import { createAdminClient } from '@/lib/supabase/admin';
import { buildLeagueModel, buildWeightedLeagueModel, matchProbabilities, type LeagueModel, type Game } from '@/lib/probability';

export type PredictionsResult = { predicted: number; scored: number };

const CURRENT_SEASON = new Date().getFullYear();

/** Modelos por liga (só ligas com tabela: algum time com points != null), iguais aos da página. */
async function leagueModels(supabase: ReturnType<typeof createAdminClient>) {
  const { data: tss } = await supabase
    .from('team_season_stats')
    .select('league_id, team_id, points, home_played, home_gf, home_ga, away_played, away_gf, away_ga, raw')
    .eq('season', CURRENT_SEASON);

  const byLeague = new Map<string, Record<string, unknown>[]>();
  for (const r of tss ?? []) {
    const lid = r.league_id as string;
    (byLeague.get(lid) ?? byLeague.set(lid, []).get(lid)!).push(r);
  }

  const models = new Map<string, LeagueModel>();
  for (const [lid, rows] of byLeague) {
    if (!rows.some((r) => r.points != null)) continue; // pula copas (sem tabela)
    const teams = rows.map((r) => ({
      teamId: r.team_id as string,
      games: ((r.raw as { schedule?: Game[] } | null)?.schedule ?? []).filter(
        (g) => typeof g.gf === 'number' && typeof g.ga === 'number',
      ),
    }));
    const m = buildWeightedLeagueModel(teams) ?? buildLeagueModel(rows as never);
    if (m) models.set(lid, m);
  }
  return models;
}

/**
 * Grava a previsão pré-jogo dos jogos AGENDADOS das ligas com tabela (upsert por match_id;
 * refresca enquanto o jogo não começou, sem tocar nas colunas de resultado). Em seguida,
 * pontua os jogos que já encerraram (preenche o placar real). Honesto: previsão sempre
 * feita com dados anteriores ao jogo; o placar real só entra depois.
 */
export async function syncPredictions(): Promise<PredictionsResult> {
  const supabase = createAdminClient();
  const models = await leagueModels(supabase);

  // --- Previsão dos jogos agendados ---
  let predicted = 0;
  const leagueIds = [...models.keys()];
  if (leagueIds.length) {
    const { data: upcoming } = await supabase
      .from('matches')
      .select('id, league_id, home_team_id, away_team_id')
      .in('league_id', leagueIds)
      .eq('status', 'scheduled');

    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    for (const m of upcoming ?? []) {
      const model = models.get(m.league_id as string)!;
      const p = matchProbabilities(model, m.home_team_id as string, m.away_team_id as string);
      if (!p) continue;
      rows.push({
        match_id: m.id,
        league_id: m.league_id,
        season: CURRENT_SEASON,
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
      const { error } = await supabase
        .from('match_predictions')
        .upsert(rows.slice(i, i + 200), { onConflict: 'match_id' });
      if (error) throw new Error(`upsert previsões: ${error.message}`);
    }
    predicted = rows.length;
  }

  // --- Pontuação dos jogos encerrados (preenche placar real onde ainda não pontuado) ---
  const { data: pending } = await supabase
    .from('match_predictions')
    .select('match_id, match:match_id(status, home_score, away_score)')
    .is('scored_at', null);

  let scored = 0;
  const scoredAt = new Date().toISOString();
  for (const row of pending ?? []) {
    const mt = row.match as unknown as { status: string; home_score: number | null; away_score: number | null } | null;
    if (!mt || mt.status !== 'finished' || mt.home_score == null || mt.away_score == null) continue;
    const { error } = await supabase
      .from('match_predictions')
      .update({ actual_home_score: mt.home_score, actual_away_score: mt.away_score, scored_at: scoredAt })
      .eq('match_id', row.match_id);
    if (error) throw new Error(`pontuação: ${error.message}`);
    scored++;
  }

  return { predicted, scored };
}
