import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnTeamRecord, fetchEspnTeamSeasonStats, fetchEspnTeamSchedule, type EspnScheduleGame } from '@/lib/espn';

export type TeamStatsResult = { processed: number; updated: number; skipped: number };

const CURRENT_SEASON = new Date().getFullYear();

/** Mapa liga canônica -> slug ESPN (alias mesclada) + ligas rastreadas (track_stats). */
async function trackedLeagues(supabase: ReturnType<typeof createAdminClient>) {
  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, track_stats, merged_into, external_api_source, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);
  const slug = new Map<string, string>();
  for (const l of leagues ?? []) {
    if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  }
  const tracked = (leagues ?? []).filter((l) => l.track_stats && !l.merged_into).map((l) => l.id as string);
  return { slug, tracked };
}

/**
 * Agregados do time na temporada (ESPN) -> team_season_stats, por competição
 * rastreada (track_stats). Ligas (com tabela): tudo via `record` (rank, V/E/D,
 * GF/GA, splits casa/fora) + `statistics` p/ clean sheets e detalhes. Copas
 * (mata-mata, sem tabela e com statistics inconsistente): agrega a partir do
 * `schedule` (resultado dos jogos), o que dá J/V/E/D/GF/GA + splits confiáveis.
 * Competições sem jogos do time são puladas.
 */
const aggregate = (gs: EspnScheduleGame[]) => ({
  played: gs.length,
  wins: gs.filter((g) => g.result === 'W').length,
  draws: gs.filter((g) => g.result === 'D').length,
  losses: gs.filter((g) => g.result === 'L').length,
  gf: gs.reduce((s, g) => s + g.gf, 0),
  ga: gs.reduce((s, g) => s + g.ga, 0),
});
export async function syncTeamSeasonStats(season = CURRENT_SEASON): Promise<TeamStatsResult> {
  const supabase = createAdminClient();
  const { slug, tracked } = await trackedLeagues(supabase);

  // time canônico + id ESPN (o espn_id vive na linha alias; merged_into = canônico).
  const { data: teamRows } = await supabase.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const teams = (teamRows ?? []).map((t) => ({ canon: (t.merged_into ?? t.id) as string, espnId: String(t.espn_id) }));

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let processed = 0;
  let skipped = 0;

  for (const leagueId of tracked) {
    const espnSlug = slug.get(leagueId);
    if (!espnSlug) continue;

    for (const { canon, espnId } of teams) {
      processed++;
      const base = { team_id: canon, league_id: leagueId, season, synced_at: now };

      let rec = null;
      try {
        rec = await fetchEspnTeamRecord(espnSlug, espnId);
      } catch {
        rec = null;
      }

      if (rec) {
        // Liga com tabela: record traz tudo (rank, V/E/D, GF/GA, splits casa/fora).
        let st = null;
        try {
          st = await fetchEspnTeamSeasonStats(espnSlug, season, espnId);
        } catch {
          st = null;
        }
        let leagueGames: EspnScheduleGame[] = [];
        try {
          leagueGames = await fetchEspnTeamSchedule(espnSlug, espnId, season);
        } catch {
          leagueGames = [];
        }
        const s = rec.stats;
        const n = (k: string) => (typeof s[k] === 'number' ? s[k] : null);
        rows.push({
          ...base,
          rank: n('rank'),
          played: n('gamesPlayed'),
          wins: n('wins'),
          draws: n('ties'),
          losses: n('losses'),
          points: n('points'),
          gf: n('pointsFor'),
          ga: n('pointsAgainst'),
          gd: n('pointDifferential'),
          home_played: n('homeGamesPlayed'),
          home_wins: n('homeWins'),
          home_draws: n('homeTies'),
          home_losses: n('homeLosses'),
          home_gf: n('homePointsFor'),
          home_ga: n('homePointsAgainst'),
          away_played: n('awayGamesPlayed'),
          away_wins: n('awayWins'),
          away_draws: n('awayTies'),
          away_losses: n('awayLosses'),
          away_gf: n('awayPointsFor'),
          away_ga: n('awayPointsAgainst'),
          clean_sheets: st ? (st.stats.cleanSheet ?? null) : null,
          raw: { record: rec.raw, statistics: st?.raw ?? null, schedule: leagueGames },
        });
        continue;
      }

      // Copa (mata-mata): sem tabela. Agrega pelos jogos encerrados (schedule);
      // o statistics entra só p/ as contagens detalhadas (gols/resultado dele são
      // inconsistentes e ficam ocultos na exibição).
      let games: EspnScheduleGame[] = [];
      try {
        games = await fetchEspnTeamSchedule(espnSlug, espnId, season);
      } catch {
        games = [];
      }
      if (!games.length) {
        skipped++;
        continue;
      }
      let cupSt = null;
      try {
        cupSt = await fetchEspnTeamSeasonStats(espnSlug, season, espnId);
      } catch {
        cupSt = null;
      }
      const all = aggregate(games);
      const home = aggregate(games.filter((g) => g.homeAway === 'home'));
      const away = aggregate(games.filter((g) => g.homeAway === 'away'));
      rows.push({
        ...base,
        rank: null,
        played: all.played,
        wins: all.wins,
        draws: all.draws,
        losses: all.losses,
        points: null,
        gf: all.gf,
        ga: all.ga,
        gd: all.gf - all.ga,
        home_played: home.played,
        home_wins: home.wins,
        home_draws: home.draws,
        home_losses: home.losses,
        home_gf: home.gf,
        home_ga: home.ga,
        away_played: away.played,
        away_wins: away.wins,
        away_draws: away.draws,
        away_losses: away.losses,
        away_gf: away.gf,
        away_ga: away.ga,
        clean_sheets: games.filter((g) => g.ga === 0).length,
        raw: { schedule: games, statistics: cupSt?.raw ?? null },
      });
    }
  }

  let updated = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('team_season_stats')
      .upsert(chunk, { onConflict: 'team_id,league_id,season' });
    if (error) throw new Error(`team_season_stats: ${error.message}`);
    updated += chunk.length;
  }

  return { processed, updated, skipped };
}
