/*
 * Sincroniza estatísticas por jogo (ESPN summary/boxscore) -> match_stats.
 * Só jogos ENCERRADOS de fonte ESPN das ligas ATIVAS sem stats ainda.
 *
 * Uso:
 *   node scripts/sync-match-stats.cjs            # dry-run (consulta, não grava)
 *   node scripts/sync-match-stats.cjs --apply
 *
 * Requer migration 016 aplicada. ESPN é grátis e sem teto; processa só o que falta.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const NAME_TO_COL = {
  possessionPct: 'possession', totalShots: 'shots', shotsOnTarget: 'shots_on_target',
  wonCorners: 'corners', foulsCommitted: 'fouls', yellowCards: 'yellow',
  redCards: 'red', offsides: 'offsides', saves: 'saves',
};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

async function summary(slug, eventId) {
  const r = await fetch(`${ESPN_BASE}/${slug}/summary?event=${eventId}`);
  if (!r.ok) return null;
  const j = await r.json();
  const comp = j?.header?.competitions?.[0];
  if (!comp) return null;
  const homeId = comp.competitors?.find((c) => c.homeAway === 'home')?.team?.id;
  const awayId = comp.competitors?.find((c) => c.homeAway === 'away')?.team?.id;
  const map = new Map();
  for (const t of j?.boxscore?.teams ?? []) {
    const side = String(t.team?.id) === String(homeId) ? 'home' : String(t.team?.id) === String(awayId) ? 'away' : null;
    if (!side) continue;
    for (const st of t.statistics ?? []) {
      const name = st.name ?? st.label ?? '';
      const e = map.get(name) ?? { name, label: st.label ?? st.name ?? '', home: '', away: '' };
      e[side] = st.displayValue ?? '';
      map.set(name, e);
    }
  }
  return { attendance: j?.gameInfo?.attendance ?? null, statistics: [...map.values()] };
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: leagues } = await s.from('leagues').select('id, curated, merged_into, external_api_source, external_api_id');
  const slug = new Map();
  for (const l of leagues ?? []) if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  const active = new Set((leagues ?? []).filter((l) => l.curated && !l.merged_into).map((l) => l.id));

  const { data: done } = await s.from('match_stats').select('match_id');
  const have = new Set((done ?? []).map((r) => r.match_id));

  const { data: matches } = await s.from('matches').select('id, league_id, external_api_id').eq('status', 'finished').eq('external_api_source', 'espn');
  const todo = (matches ?? []).filter((m) => active.has(m.league_id) && slug.has(m.league_id) && m.external_api_id && !have.has(m.id));
  console.log(`Jogos pendentes de stats: ${todo.length}${APPLY ? '' : ' (dry-run)'}`);

  const now = new Date().toISOString();
  const rows = [];
  let skipped = 0;
  for (const m of todo) {
    const sum = await summary(slug.get(m.league_id), m.external_api_id);
    if (!sum || !sum.statistics.length) { skipped++; continue; }
    const row = { match_id: m.id, attendance: sum.attendance, raw: sum.statistics, synced_at: now };
    for (const st of sum.statistics) { const c = NAME_TO_COL[st.name]; if (!c) continue; row[`home_${c}`] = num(st.home); row[`away_${c}`] = num(st.away); }
    rows.push(row);
  }
  console.log(`Com estatísticas: ${rows.length}; sem stats na ESPN: ${skipped}`);

  if (APPLY) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await s.from('match_stats').upsert(rows.slice(i, i + 200), { onConflict: 'match_id' });
      if (error) throw new Error(error.message);
    }
    console.log(`Gravados: ${rows.length}`);
  } else if (rows[0]) {
    console.log('Exemplo:', JSON.stringify(rows[0]));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
