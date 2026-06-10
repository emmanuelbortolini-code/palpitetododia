import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnLeaders } from '@/lib/espn';

export type PlayerStatsResult = { leagues: number; updated: number };

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
 * Artilheiros/líderes por jogador (ESPN leaders) -> player_season_stats, por
 * competição rastreada (track_stats). Resolve o time canônico via espn_id.
 */
export async function syncPlayerSeasonStats(season = CURRENT_SEASON): Promise<PlayerStatsResult> {
  const supabase = createAdminClient();
  const { slug, tracked } = await trackedLeagues(supabase);

  // id ESPN do time -> time canônico (espn_id vive na linha alias; merged_into = canônico).
  const { data: teamRows } = await supabase.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const canonByEspn = new Map<string, string>();
  for (const t of teamRows ?? []) canonByEspn.set(String(t.espn_id), (t.merged_into ?? t.id) as string);

  const now = new Date().toISOString();
  let updated = 0;
  let leaguesDone = 0;

  for (const leagueId of tracked) {
    const espnSlug = slug.get(leagueId);
    if (!espnSlug) continue;
    const players = await fetchEspnLeaders(espnSlug, season);
    if (!players.length) continue;
    leaguesDone++;

    const rows = players.map((p) => ({
      league_id: leagueId,
      season,
      espn_athlete_id: p.athleteId,
      player_name: p.name || null,
      position: p.position,
      team_id: p.teamEspnId ? canonByEspn.get(p.teamEspnId) ?? null : null,
      goals: p.goals,
      assists: p.assists,
      shots: p.shots,
      shots_on_target: p.shotsOnTarget,
      yellow: p.yellow,
      red: p.red,
      fouls: p.fouls,
      saves: p.saves,
      raw: null,
      synced_at: now,
    }));

    // Regrava a competição inteira (remove quem saiu do top antes de inserir).
    await supabase.from('player_season_stats').delete().eq('league_id', leagueId).eq('season', season);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabase.from('player_season_stats').insert(chunk);
      if (error) throw new Error(`player_season_stats: ${error.message}`);
      updated += chunk.length;
    }
  }

  return { leagues: leaguesDone, updated };
}
