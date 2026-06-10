import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnTeamRecord, fetchEspnTeamSeasonStats } from '@/lib/espn';

export type TeamStatsResult = { processed: number; updated: number; skipped: number };

const CURRENT_SEASON = new Date().getFullYear();

/** Mapa liga canônica -> slug ESPN (alias mesclada) + ligas ativas. Padrão de fixtures.ts. */
async function espnLeagues(supabase: ReturnType<typeof createAdminClient>) {
  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, curated, merged_into, external_api_source, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);
  const slug = new Map<string, string>();
  for (const l of leagues ?? []) {
    if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  }
  const active = (leagues ?? []).filter((l) => l.curated && !l.merged_into).map((l) => l.id as string);
  return { slug, active };
}

/**
 * Agregados do time na temporada (ESPN record + statistics) -> team_season_stats.
 * Itera os times de cada liga ATIVA (via team_leagues da temporada) e regrava a
 * linha do time. ESPN: pointsFor=GF, pointsAgainst=GA, ties=empates.
 */
export async function syncTeamSeasonStats(season = CURRENT_SEASON): Promise<TeamStatsResult> {
  const supabase = createAdminClient();
  const { slug, active } = await espnLeagues(supabase);

  // time canônico -> id ESPN (o espn_id vive na linha alias; merged_into = canônico).
  const { data: teamRows } = await supabase.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const espnByCanon = new Map<string, string>();
  for (const t of teamRows ?? []) espnByCanon.set((t.merged_into ?? t.id) as string, String(t.espn_id));

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let processed = 0;
  let skipped = 0;

  for (const leagueId of active) {
    const espnSlug = slug.get(leagueId);
    if (!espnSlug) continue;
    const { data: tl } = await supabase
      .from('team_leagues')
      .select('team_id')
      .eq('league_id', leagueId)
      .eq('season', season);

    for (const row of tl ?? []) {
      const teamId = row.team_id as string;
      const espnId = espnByCanon.get(teamId);
      if (!espnId) {
        skipped++;
        continue;
      }
      processed++;
      let rec = null;
      let st = null;
      try {
        rec = await fetchEspnTeamRecord(espnSlug, espnId);
      } catch {
        rec = null;
      }
      try {
        st = await fetchEspnTeamSeasonStats(espnSlug, season, espnId);
      } catch {
        st = null;
      }
      if (!rec) {
        skipped++;
        continue;
      }
      const s = rec.stats;
      const n = (k: string) => (typeof s[k] === 'number' ? s[k] : null);
      rows.push({
        team_id: teamId,
        league_id: leagueId,
        season,
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
        clean_sheets: st?.cleanSheets ?? null,
        raw: { record: rec.raw, statistics: st?.raw ?? null },
        synced_at: now,
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
