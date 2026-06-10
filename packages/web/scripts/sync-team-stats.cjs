/*
 * Sincroniza agregados de temporada por time (ESPN record + statistics) -> team_season_stats.
 * Itera os times de cada liga ATIVA via team_leagues da temporada atual.
 *
 * Uso:
 *   node scripts/sync-team-stats.cjs            # dry-run (consulta, não grava)
 *   node scripts/sync-team-stats.cjs --apply
 *
 * Requer migration 017 aplicada. ESPN é grátis e sem teto.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SEASON = new Date().getFullYear();
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

async function teamRecord(slug, teamId) {
  const r = await fetch(`${ESPN_BASE}/${slug}/teams/${teamId}`);
  if (!r.ok) return null;
  const j = await r.json();
  const items = j?.team?.record?.items ?? [];
  const total = items.find((it) => it.type === 'total') ?? items[0];
  if (!total) return null;
  const stats = {};
  for (const s of total.stats ?? []) if (typeof s.value === 'number') stats[s.name] = s.value;
  return { stats, raw: items };
}

async function teamSeasonStats(slug, season, teamId) {
  const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${season}/types/1/teams/${teamId}/statistics`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const cats = j?.splits?.categories ?? [];
  const cs = cats.find((c) => c.name === 'goalKeeping')?.stats?.find((s) => s.name === 'cleanSheet')?.value ?? null;
  return { cleanSheets: typeof cs === 'number' ? cs : null, raw: cats };
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: leagues } = await s.from('leagues').select('id, curated, merged_into, external_api_source, external_api_id');
  const slug = new Map();
  for (const l of leagues ?? []) if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  const active = (leagues ?? []).filter((l) => l.curated && !l.merged_into).map((l) => l.id);

  const { data: teamRows } = await s.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const espnByCanon = new Map();
  for (const t of teamRows ?? []) espnByCanon.set(t.merged_into ?? t.id, String(t.espn_id));

  const now = new Date().toISOString();
  const rows = [];
  let processed = 0;
  let skipped = 0;

  for (const leagueId of active) {
    const espnSlug = slug.get(leagueId);
    if (!espnSlug) continue;
    const { data: tl } = await s.from('team_leagues').select('team_id').eq('league_id', leagueId).eq('season', SEASON);
    for (const { team_id } of tl ?? []) {
      const espnId = espnByCanon.get(team_id);
      if (!espnId) { skipped++; continue; }
      processed++;
      const rec = await teamRecord(espnSlug, espnId);
      const st = await teamSeasonStats(espnSlug, SEASON, espnId);
      if (!rec) { skipped++; continue; }
      const v = rec.stats;
      const n = (k) => (typeof v[k] === 'number' ? v[k] : null);
      rows.push({
        team_id, league_id: leagueId, season: SEASON,
        rank: n('rank'),
        played: n('gamesPlayed'), wins: n('wins'), draws: n('ties'), losses: n('losses'),
        points: n('points'), gf: n('pointsFor'), ga: n('pointsAgainst'), gd: n('pointDifferential'),
        home_played: n('homeGamesPlayed'), home_wins: n('homeWins'), home_draws: n('homeTies'),
        home_losses: n('homeLosses'), home_gf: n('homePointsFor'), home_ga: n('homePointsAgainst'),
        away_played: n('awayGamesPlayed'), away_wins: n('awayWins'), away_draws: n('awayTies'),
        away_losses: n('awayLosses'), away_gf: n('awayPointsFor'), away_ga: n('awayPointsAgainst'),
        clean_sheets: st ? st.cleanSheets : null,
        raw: { record: rec.raw, statistics: st ? st.raw : null },
        synced_at: now,
      });
    }
  }
  console.log(`Times processados: ${processed}; com record: ${rows.length}; sem dados: ${skipped}${APPLY ? '' : ' (dry-run)'}`);

  if (APPLY) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await s.from('team_season_stats').upsert(rows.slice(i, i + 200), { onConflict: 'team_id,league_id,season' });
      if (error) throw new Error(error.message);
    }
    console.log(`Gravados: ${rows.length}`);
  } else if (rows[0]) {
    console.log('Exemplo:', JSON.stringify(rows[0]));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
