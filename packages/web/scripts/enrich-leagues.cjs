/*
 * Snapshots das ligas para as abas Dados ESPN / Dados Football API:
 *   - AF /leagues?id=<id>  -> api_football_data { name, type, logo, country, seasons }
 *     (gravado na linha api_football das ligas CURADAS).
 *   - ESPN /<slug>/teams   -> espn_data { name, slug, logo, season, teams }
 *     (gravado na linha espn de cada liga ESPN).
 *
 * Uso: node scripts/enrich-leagues.cjs [--apply]
 * Requer migration 015. AF: 1 req por liga curada (throttle p/ o limite/min).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

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

  const { data: leagues, error } = await s
    .from('leagues')
    .select('id, name, external_api_source, external_api_id, curated');
  if (error) throw new Error(error.message);

  // AF: ligas curadas com fonte api_football.
  const afLeagues = leagues.filter((l) => l.curated && l.external_api_source === 'api_football');
  // ESPN: todas as linhas de fonte espn.
  const espnLeagues = leagues.filter((l) => l.external_api_source === 'espn');

  let afDone = 0, espnDone = 0;

  for (let i = 0; i < afLeagues.length; i++) {
    const l = afLeagues[i];
    let j;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`${afBase}/leagues?id=${l.external_api_id}`, { headers: { 'x-apisports-key': afKey } });
      j = await r.json();
      const rate = j.errors && (j.errors.rateLimit || j.errors.requests);
      if (rate && attempt === 0) { console.log(`  AF ${l.name}: rate limit, 60s…`); await sleep(60000); continue; }
      break;
    }
    const L = j.response && j.response[0];
    if (!L) { console.log(`  AF ${l.name}: sem dados`); }
    else {
      const data = {
        name: L.league.name, type: L.league.type, logo: L.league.logo,
        country: L.country,
        seasons: (L.seasons || []).map((x) => ({ year: x.year, current: x.current })),
      };
      console.log(`  AF ${l.name}: ${data.seasons.length} temporadas`);
      if (APPLY) { await s.from('leagues').update({ api_football_data: data }).eq('id', l.id); afDone++; }
    }
    if (i < afLeagues.length - 1) await sleep(6500);
  }

  for (const l of espnLeagues) {
    const r = await fetch(`${ESPN_BASE}/${l.external_api_id}/teams`, { cache: 'no-store' });
    const ej = await r.json();
    const lg = ej?.sports?.[0]?.leagues?.[0];
    if (!lg) { console.log(`  ESPN ${l.name}: sem dados`); continue; }
    // Classificação (tabela).
    let standings = [];
    try {
      const sr = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${l.external_api_id}/standings`, { cache: 'no-store' });
      if (sr.ok) {
        const sj = await sr.json();
        const entries = sj?.children?.[0]?.standings?.entries ?? sj?.standings?.entries ?? [];
        const val = (e, abbr) => (e.stats || []).find((x) => x.abbreviation === abbr)?.displayValue ?? '';
        standings = entries
          .map((e) => ({
            rank: Number(val(e, 'R')) || null, teamId: String(e.team?.id ?? ''),
            name: e.team?.displayName ?? '', logo: e.team?.logos?.[0]?.href ?? null,
            gp: val(e, 'GP'), w: val(e, 'W'), d: val(e, 'D'), l: val(e, 'L'),
            gf: val(e, 'F'), ga: val(e, 'A'), gd: val(e, 'GD'), points: val(e, 'P'),
          }))
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      }
    } catch {}
    const data = {
      name: lg.name, slug: lg.slug, logo: lg.logos?.[0]?.href ?? null,
      season: lg.season ? { year: lg.season.year, displayName: lg.season.displayName } : null,
      teams: (lg.teams || []).map((t) => ({ id: String(t.team.id), name: t.team.displayName ?? t.team.name, logo: t.team.logos?.[0]?.href ?? null })),
      standings,
    };
    console.log(`  ESPN ${l.name}: temporada ${data.season?.year ?? '?'}, ${data.teams.length} times, ${standings.length} na tabela`);
    if (APPLY) { await s.from('leagues').update({ espn_data: data }).eq('id', l.id); espnDone++; }
  }

  console.log(`\n${APPLY ? 'Gravado' : 'Dry-run'}: api_football_data=${APPLY ? afDone : afLeagues.length}, espn_data=${APPLY ? espnDone : espnLeagues.length}`);
  if (!APPLY) console.log('Rode com --apply.');
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
