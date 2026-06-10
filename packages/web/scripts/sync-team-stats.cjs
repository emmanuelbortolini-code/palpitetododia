/*
 * Sincroniza agregados de temporada por time (ESPN) -> team_season_stats, por
 * competição rastreada (leagues.track_stats). Totais saem do `statistics` (liga e
 * copa); `record` adiciona rank + splits casa/fora (só ligas com tabela).
 *
 * Uso:
 *   node scripts/sync-team-stats.cjs            # dry-run (consulta, não grava)
 *   node scripts/sync-team-stats.cjs --apply
 *
 * Requer migrations 017 e 018 aplicadas. ESPN é grátis e sem teto.
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
  const total = items.find((it) => it.type === 'total');
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
  if (!cats.length) return null;
  const stats = {};
  for (const c of cats) for (const s of c.stats ?? []) if (typeof s.value === 'number') stats[s.name] = s.value;
  return { stats, raw: cats };
}

async function teamSchedule(slug, teamId, season) {
  const r = await fetch(`${ESPN_BASE}/${slug}/teams/${teamId}/schedule`);
  if (!r.ok) return [];
  const j = await r.json();
  const out = [];
  for (const e of j?.events ?? []) {
    const comp = e?.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    if (typeof e.date === 'string' && !e.date.startsWith(String(season))) continue;
    const me = (comp.competitors || []).find((c) => String(c.team?.id) === String(teamId));
    const opp = (comp.competitors || []).find((c) => String(c.team?.id) !== String(teamId));
    if (!me || !opp) continue;
    const gf = Number(me.score?.value), ga = Number(opp.score?.value);
    if (!Number.isFinite(gf) || !Number.isFinite(ga)) continue;
    out.push({ date: e.date, homeAway: me.homeAway === 'home' ? 'home' : 'away', gf, ga, opponent: opp.team?.displayName ?? opp.team?.abbreviation ?? '', result: gf > ga ? 'W' : gf < ga ? 'L' : 'D' });
  }
  return out;
}

const aggregate = (gs) => ({
  played: gs.length,
  wins: gs.filter((g) => g.result === 'W').length,
  draws: gs.filter((g) => g.result === 'D').length,
  losses: gs.filter((g) => g.result === 'L').length,
  gf: gs.reduce((s, g) => s + g.gf, 0),
  ga: gs.reduce((s, g) => s + g.ga, 0),
});

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: leagues } = await s.from('leagues').select('id, track_stats, merged_into, external_api_source, external_api_id');
  const slug = new Map();
  for (const l of leagues ?? []) if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  const tracked = (leagues ?? []).filter((l) => l.track_stats && !l.merged_into).map((l) => l.id);

  const { data: teamRows } = await s.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const teams = (teamRows ?? []).map((t) => ({ canon: t.merged_into ?? t.id, espnId: String(t.espn_id) }));

  const now = new Date().toISOString();
  const rows = [];
  let processed = 0;
  let skipped = 0;

  for (const leagueId of tracked) {
    const espnSlug = slug.get(leagueId);
    if (!espnSlug) continue;
    for (const { canon, espnId } of teams) {
      processed++;
      const base = { team_id: canon, league_id: leagueId, season: SEASON, synced_at: now };
      const rec = await teamRecord(espnSlug, espnId);

      if (rec) {
        const st = await teamSeasonStats(espnSlug, SEASON, espnId);
        const v = rec.stats;
        const n = (k) => (typeof v[k] === 'number' ? v[k] : null);
        rows.push({
          ...base,
          rank: n('rank'), played: n('gamesPlayed'), wins: n('wins'), draws: n('ties'), losses: n('losses'),
          points: n('points'), gf: n('pointsFor'), ga: n('pointsAgainst'), gd: n('pointDifferential'),
          home_played: n('homeGamesPlayed'), home_wins: n('homeWins'), home_draws: n('homeTies'),
          home_losses: n('homeLosses'), home_gf: n('homePointsFor'), home_ga: n('homePointsAgainst'),
          away_played: n('awayGamesPlayed'), away_wins: n('awayWins'), away_draws: n('awayTies'),
          away_losses: n('awayLosses'), away_gf: n('awayPointsFor'), away_ga: n('awayPointsAgainst'),
          clean_sheets: st ? (st.stats.cleanSheet ?? null) : null,
          raw: { record: rec.raw, statistics: st ? st.raw : null },
        });
        continue;
      }

      const games = await teamSchedule(espnSlug, espnId, SEASON);
      if (!games.length) { skipped++; continue; }
      const cupSt = await teamSeasonStats(espnSlug, SEASON, espnId);
      const all = aggregate(games), home = aggregate(games.filter((g) => g.homeAway === 'home')), away = aggregate(games.filter((g) => g.homeAway === 'away'));
      rows.push({
        ...base,
        rank: null, played: all.played, wins: all.wins, draws: all.draws, losses: all.losses,
        points: null, gf: all.gf, ga: all.ga, gd: all.gf - all.ga,
        home_played: home.played, home_wins: home.wins, home_draws: home.draws, home_losses: home.losses, home_gf: home.gf, home_ga: home.ga,
        away_played: away.played, away_wins: away.wins, away_draws: away.draws, away_losses: away.losses, away_gf: away.gf, away_ga: away.ga,
        clean_sheets: games.filter((g) => g.ga === 0).length,
        raw: { schedule: games, statistics: cupSt ? cupSt.raw : null },
      });
    }
  }
  console.log(`Processados: ${processed}; gravar: ${rows.length}; sem participacao: ${skipped}${APPLY ? '' : ' (dry-run)'}`);

  if (APPLY) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await s.from('team_season_stats').upsert(rows.slice(i, i + 200), { onConflict: 'team_id,league_id,season' });
      if (error) throw new Error(error.message);
    }
    console.log(`Gravados: ${rows.length}`);
  } else {
    const byLeague = {};
    for (const r of rows) byLeague[r.league_id] = (byLeague[r.league_id] || 0) + 1;
    console.log('Por liga:', JSON.stringify(byLeague));
    if (rows.find((r) => r.points == null)) console.log('Exemplo copa:', JSON.stringify(rows.find((r) => r.points == null)).slice(0, 300));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
