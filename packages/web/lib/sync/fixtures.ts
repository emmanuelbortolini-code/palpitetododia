import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnFixtures, type EspnEvent } from '@/lib/espn';

export type EspnFixturesResult = { leagues: number; matches: number; skipped: number };

// Status da ESPN -> CHECK de matches.status.
function mapStatus(e: EspnEvent): string {
  if (e.state === 'pre') return 'scheduled';
  if (e.state === 'in') return 'live';
  const n = e.statusName.toUpperCase();
  if (n.includes('POSTPON')) return 'postponed';
  if (n.includes('CANCEL') || n.includes('ABANDON') || n.includes('FORFEIT')) return 'cancelled';
  if (e.completed) return 'finished';
  return 'scheduled';
}

/**
 * Sincroniza os JOGOS (temporada atual) das ligas ATIVAS via ESPN para `matches`.
 * Resolve mandante/visitante pelo espn_id -> time canônico; pula jogos cujos
 * times ainda não temos. Upsert por (external_api_source='espn', external_api_id).
 */
export async function syncEspnFixtures(): Promise<EspnFixturesResult> {
  const supabase = createAdminClient();
  const year = new Date().getFullYear();
  const now = new Date().toISOString();

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, curated, merged_into, external_api_source, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);
  const espnAliasByCanon = new Map<string, string>();
  for (const l of leagues ?? []) {
    if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) espnAliasByCanon.set(l.merged_into, l.external_api_id);
  }
  const active = (leagues ?? []).filter((l) => l.curated && !l.merged_into);

  const { data: teams } = await supabase.from('teams').select('id, espn_id, merged_into');
  const teamByEspn = new Map<string, string>();
  for (const t of teams ?? []) if (t.espn_id) teamByEspn.set(String(t.espn_id), t.merged_into ?? t.id);

  let leaguesDone = 0;
  let skipped = 0;
  const byEvent = new Map<string, Record<string, unknown>>();

  for (const c of active) {
    const slug = espnAliasByCanon.get(c.id);
    if (!slug) continue;
    const events = await fetchEspnFixtures(slug, year);
    leaguesDone++;
    for (const e of events) {
      const home = e.homeId ? teamByEspn.get(e.homeId) : undefined;
      const away = e.awayId ? teamByEspn.get(e.awayId) : undefined;
      if (!home || !away || home === away) { skipped++; continue; }
      let status = mapStatus(e);
      const hasScores = e.homeScore != null && e.awayScore != null;
      if (status === 'finished' && !hasScores) status = 'cancelled';
      const finished = status === 'finished';
      byEvent.set(e.id, {
        league_id: c.id,
        home_team_id: home,
        away_team_id: away,
        scheduled_at: e.date,
        status,
        home_score: finished ? e.homeScore : null,
        away_score: finished ? e.awayScore : null,
        external_api_id: e.id,
        external_api_source: 'espn',
        last_synced_at: now,
        updated_at: now,
      });
    }
  }

  const rows = [...byEvent.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error: me } = await supabase
      .from('matches')
      .upsert(rows.slice(i, i + 500), { onConflict: 'external_api_source,external_api_id' });
    if (me) throw new Error(`matches: ${me.message}`);
  }

  return { leagues: leaguesDone, matches: rows.length, skipped };
}
