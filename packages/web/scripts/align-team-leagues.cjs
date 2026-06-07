/*
 * Alinha os times às ligas curadas (team_leagues), de AMBAS as fontes:
 *   - API-Football: rosters /teams season 2024 das 13 ligas curadas.
 *   - ESPN: rosters atuais das 8 ligas ESPN (resolve liga ESPN -> canônica AF).
 * Vínculos sempre apontam para o TIME canônico e a LIGA canônica (curada).
 * Antes, limpa vínculos de ligas não-curadas e de times alias.
 *
 * Uso: node scripts/align-team-leagues.cjs [--apply]
 * Requer migrations 013 + curate-leagues.cjs já rodado. AF: 13 req espaçadas.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const AF_SEASON = 2024;
const ESPN_SEASON = new Date().getFullYear(); // roster atual
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_SLUGS = ['bra.1', 'bra.2', 'bra.3', 'bra.copa_do_brazil', 'bra.camp.paulista', 'bra.camp.carioca', 'bra.camp.mineiro', 'bra.camp.gaucho'];

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => {
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY'),
    afBase: get('API_FOOTBALL_BASE_URL') || 'https://v3.football.api-sports.io', afKey: get('API_FOOTBALL_KEY'),
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { url, key, afBase, afKey } = loadEnv();
  const s = createClient(url, key);

  const { data: leagues } = await s.from('leagues').select('id, external_api_source, external_api_id, curated, merged_into');
  const curatedAfByApiId = new Map(); // af league id -> league.id (curada)
  const espnLeagueToCanon = new Map(); // espn slug -> liga canônica id
  const curatedIds = [];
  for (const l of leagues) {
    if (l.curated) curatedIds.push(l.id);
    if (l.curated && l.external_api_source === 'api_football') curatedAfByApiId.set(String(l.external_api_id), l.id);
    if (l.external_api_source === 'espn' && l.merged_into) espnLeagueToCanon.set(String(l.external_api_id), l.merged_into);
  }

  const { data: teams } = await s.from('teams').select('id, api_football_id, espn_id, merged_into');
  const teamByAf = new Map(); const teamByEspn = new Map(); const aliasIds = [];
  for (const t of teams) {
    const canon = t.merged_into ?? t.id;
    if (t.merged_into) aliasIds.push(t.id);
    if (t.api_football_id) teamByAf.set(String(t.api_football_id), canon);
    if (t.espn_id) teamByEspn.set(String(t.espn_id), canon);
  }

  // Coleta vínculos das duas fontes.
  const links = new Map(); // chave team|league|season -> obj
  const add = (team_id, league_id, season) => {
    if (!team_id || !league_id) return;
    links.set(`${team_id}|${league_id}|${season}`, { team_id, league_id, season });
  };

  // AF rosters 2024 (throttled).
  const afEntries = [...curatedAfByApiId.entries()];
  for (let i = 0; i < afEntries.length; i++) {
    const [afApiId, leagueId] = afEntries[i];
    let j;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`${afBase}/teams?league=${afApiId}&season=${AF_SEASON}`, { headers: { 'x-apisports-key': afKey } });
      j = await r.json();
      const rate = j.errors && (j.errors.rateLimit || j.errors.requests);
      if (rate && attempt === 0) { console.log(`  AF ${afApiId}: rate limit, 60s…`); await sleep(60000); continue; }
      break;
    }
    let n = 0;
    for (const x of j.response ?? []) { const c = teamByAf.get(String(x.team.id)); if (c) { add(c, leagueId, AF_SEASON); n++; } }
    console.log(`  AF liga ${afApiId}: ${n} vínculos (2024)`);
    if (i < afEntries.length - 1) await sleep(6500);
  }

  // ESPN rosters atuais.
  for (const slug of ESPN_SLUGS) {
    const leagueId = espnLeagueToCanon.get(slug);
    if (!leagueId) { console.log(`  ESPN ${slug}: sem liga canônica`); continue; }
    const r = await fetch(`${ESPN_BASE}/${slug}/teams`, { cache: 'no-store' });
    const json = await r.json();
    const lg = json?.sports?.[0]?.leagues?.[0];
    let n = 0;
    for (const t of lg?.teams ?? []) { const c = teamByEspn.get(String(t.team.id)); if (c) { add(c, leagueId, ESPN_SEASON); n++; } }
    console.log(`  ESPN ${slug}: ${n} vínculos (${ESPN_SEASON})`);
  }

  const rows = [...links.values()];
  console.log(`\nVínculos a gravar: ${rows.length} | limpar: ligas não-curadas + ${aliasIds.length} times alias`);
  if (!APPLY) { console.log('DRY-RUN. Rode com --apply.'); return; }

  // Limpeza.
  await s.from('team_leagues').delete().not('league_id', 'in', `(${curatedIds.join(',')})`);
  if (aliasIds.length) {
    for (let i = 0; i < aliasIds.length; i += 100) {
      await s.from('team_leagues').delete().in('team_id', aliasIds.slice(i, i + 100));
    }
  }
  // Upsert em lotes.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await s.from('team_leagues').upsert(rows.slice(i, i + 500), { onConflict: 'team_id,league_id,season', ignoreDuplicates: true });
    if (error) throw new Error(`team_leagues: ${error.message}`);
  }
  const { count } = await s.from('team_leagues').select('*', { count: 'exact', head: true });
  console.log(`\nFeito. team_leagues agora tem ${count} vínculos.`);
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
