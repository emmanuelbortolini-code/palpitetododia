/*
 * Sincroniza artilheiros/líderes por jogador (ESPN leaders) -> player_season_stats,
 * por competição rastreada (leagues.track_stats). Resolve o time canônico via espn_id.
 *
 * Uso:
 *   node scripts/sync-player-stats.cjs            # dry-run (consulta, não grava)
 *   node scripts/sync-player-stats.cjs --apply
 *
 * Requer migration 019 aplicada. ESPN é grátis e sem teto.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SEASON = new Date().getFullYear();
const CORE = 'https://sports.core.api.espn.com/v2/sports/soccer';

const CAT_FIELD = {
  goals: 'goals', assists: 'assists', totalShots: 'shots', shotsOnTarget: 'shots_on_target',
  yellowCards: 'yellow', redCards: 'red', foulsCommitted: 'fouls', saves: 'saves',
};

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

const idFrom = (ref, kind) => { const m = new RegExp(kind + '/(\\d+)').exec(ref || ''); return m ? m[1] : null; };

async function leaders(slug) {
  const r = await fetch(`${CORE}/leagues/${slug}/seasons/${SEASON}/types/1/leaders`);
  if (!r.ok) return [];
  const j = await r.json();
  const byId = new Map();
  for (const cat of j?.categories ?? []) {
    const f = CAT_FIELD[cat.name];
    if (!f) continue;
    for (const ld of cat.leaders ?? []) {
      const aid = idFrom(ld.athlete?.$ref, 'athletes');
      if (!aid) continue;
      let p = byId.get(aid);
      if (!p) { p = { espn_athlete_id: aid, player_name: '', position: null, teamEspnId: idFrom(ld.team?.$ref, 'teams') }; byId.set(aid, p); }
      if (typeof ld.value === 'number') p[f] = ld.value;
      if (!p.teamEspnId) p.teamEspnId = idFrom(ld.team?.$ref, 'teams');
    }
  }
  const players = [...byId.values()];
  for (let i = 0; i < players.length; i += 12) {
    await Promise.all(players.slice(i, i + 12).map(async (p) => {
      try {
        const ar = await fetch(`${CORE}/leagues/${slug}/seasons/${SEASON}/athletes/${p.espn_athlete_id}?lang=en&region=us`);
        if (!ar.ok) return;
        const a = await ar.json();
        p.player_name = a.displayName ?? a.fullName ?? '';
        p.position = a.position?.abbreviation ?? null;
      } catch {}
    }));
  }
  return players;
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: lg } = await s.from('leagues').select('id, track_stats, merged_into, external_api_source, external_api_id');
  const slug = new Map();
  for (const l of lg ?? []) if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  const tracked = (lg ?? []).filter((l) => l.track_stats && !l.merged_into).map((l) => l.id);

  const { data: teamRows } = await s.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const canonByEspn = new Map();
  for (const t of teamRows ?? []) canonByEspn.set(String(t.espn_id), t.merged_into ?? t.id);

  const now = new Date().toISOString();
  for (const leagueId of tracked) {
    const espnSlug = slug.get(leagueId);
    if (!espnSlug) continue;
    const players = await leaders(espnSlug);
    const rows = players.map((p) => ({
      league_id: leagueId, season: SEASON, espn_athlete_id: p.espn_athlete_id,
      player_name: p.player_name || null, position: p.position || null,
      team_id: p.teamEspnId ? (canonByEspn.get(p.teamEspnId) || null) : null,
      goals: p.goals ?? null, assists: p.assists ?? null, shots: p.shots ?? null, shots_on_target: p.shots_on_target ?? null,
      yellow: p.yellow ?? null, red: p.red ?? null, fouls: p.fouls ?? null, saves: p.saves ?? null,
      raw: null, synced_at: now,
    }));
    const top = [...rows].filter((r) => r.goals != null).sort((a, b) => b.goals - a.goals).slice(0, 5);
    console.log(`[${espnSlug}] ${rows.length} jogadores${APPLY ? '' : ' (dry-run)'}. Top gols:`, top.map((r) => `${r.player_name}(${r.goals})`).join(', '));

    if (APPLY) {
      await s.from('player_season_stats').delete().eq('league_id', leagueId).eq('season', SEASON);
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await s.from('player_season_stats').insert(rows.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
    }
  }
  if (APPLY) console.log('Gravado.');
}

main().catch((e) => { console.error(e); process.exit(1); });
