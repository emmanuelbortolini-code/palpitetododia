/*
 * Ingestão estrutural da Copa do Mundo FIFA 2026 (fonte ESPN, slug fifa.world):
 *  - país "Internacional"
 *  - liga canônica (api_football id=1) + alias ESPN (fifa.world) merged nela
 *  - 48 seleções (teams.espn_id) + vínculos team_leagues (temporada 2026)
 *  - jogos (scoreboard ESPN por dia, janela do torneio) -> matches
 * Idempotente. Espelha o padrão BR (refdata/team-providers/fixtures) sem mexer nele.
 *
 * Uso:
 *   node scripts/sync-worldcup.cjs            # dry-run
 *   node scripts/sync-worldcup.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SEASON = 2026;
const SLUG = 'fifa.world';
const B = `https://site.api.espn.com/apis/site/v2/sports/soccer/${SLUG}`;
const START = '2026-06-11';
const END = '2026-07-19';

function loadEnv() {
  const e = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const g = (k) => { const m = e.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: g('NEXT_PUBLIC_SUPABASE_URL'), key: g('SUPABASE_SERVICE_ROLE_KEY') };
}
const slugify = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110) || 'time';

function mapStatus(state, completed, desc, hasScores) {
  if (state === 'pre') return 'scheduled';
  if (state === 'in') return 'live';
  const n = (desc || '').toUpperCase();
  if (n.includes('POSTPON')) return 'postponed';
  if (n.includes('CANCEL') || n.includes('ABANDON') || n.includes('FORFEIT')) return 'cancelled';
  if (completed) return hasScores ? 'finished' : 'cancelled';
  return 'scheduled';
}

function* days(start, end) {
  for (let d = new Date(start + 'T00:00:00Z'); d <= new Date(end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    yield `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  }
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  // 1) país Internacional
  let countryId;
  {
    if (APPLY) {
      const { data, error } = await s.from('countries').upsert({ code: 'UN', name: 'Internacional', flag_emoji: '🌍' }, { onConflict: 'code' }).select('id').single();
      if (error) throw new Error('countries: ' + error.message);
      countryId = data.id;
    } else {
      const { data } = await s.from('countries').select('id').eq('code', 'UN').maybeSingle();
      countryId = data?.id || '(novo)';
    }
    console.log('país Internacional:', countryId);
  }

  // 2) liga canônica (AF id=1) + alias ESPN (fifa.world)
  let canonId;
  {
    const canon = { country_id: countryId === '(novo)' ? null : countryId, name: 'Copa do Mundo FIFA', slug: 'copa-do-mundo-fifa', is_active: true, external_api_id: '1', external_api_source: 'api_football', curated: true, track_stats: false };
    if (APPLY) {
      const { data, error } = await s.from('leagues').upsert(canon, { onConflict: 'external_api_source,external_api_id' }).select('id').single();
      if (error) throw new Error('liga canônica: ' + error.message);
      canonId = data.id;
      const alias = { country_id: countryId, name: 'FIFA World Cup', slug: 'fifa-world-cup-espn', is_active: true, external_api_id: SLUG, external_api_source: 'espn', curated: false, track_stats: false, merged_into: canonId };
      const { error: ae } = await s.from('leagues').upsert(alias, { onConflict: 'external_api_source,external_api_id' });
      if (ae) throw new Error('alias ESPN: ' + ae.message);
    } else {
      const { data } = await s.from('leagues').select('id').eq('external_api_source', 'api_football').eq('external_api_id', '1').maybeSingle();
      canonId = data?.id || '(novo)';
    }
    console.log('liga canônica Copa:', canonId, '| alias espn:', SLUG);
  }

  // 3) seleções (roster ESPN) + team_leagues
  const roster = (await (await fetch(`${B}/teams`)).json()).sports?.[0]?.leagues?.[0]?.teams ?? [];
  console.log('roster ESPN:', roster.length, 'seleções');
  const { data: existing } = await s.from('teams').select('id, espn_id, merged_into').not('espn_id', 'is', null);
  const byEspn = new Map((existing ?? []).map((t) => [String(t.espn_id), t]));
  let created = 0, updated = 0;
  const teamIdByEspn = new Map();
  for (const it of roster) {
    const t = it.team;
    const espnId = String(t.id);
    const logo = t.logos?.[0]?.href ?? null;
    const snap = { name: t.displayName, logo_url: logo };
    const ex = byEspn.get(espnId);
    if (ex) {
      teamIdByEspn.set(espnId, ex.merged_into ?? ex.id);
      if (APPLY) await s.from('teams').update({ espn_data: snap }).eq('id', ex.id);
      updated++;
    } else if (APPLY) {
      const { data: ins, error } = await s.from('teams').insert({ country_id: countryId, name: t.displayName, slug: `${slugify(t.displayName)}-espn-${espnId}`, logo_url: logo, espn_id: espnId, espn_data: snap }).select('id').single();
      if (error) throw new Error(`insert ${t.displayName}: ${error.message}`);
      teamIdByEspn.set(espnId, ins.id);
      created++;
    } else {
      teamIdByEspn.set(espnId, '(novo)');
      created++;
    }
  }
  console.log(`seleções: ${created} criadas, ${updated} atualizadas`);
  if (APPLY && typeof canonId === 'string' && canonId !== '(novo)') {
    const links = [...teamIdByEspn.values()].filter((v) => v !== '(novo)').map((team_id) => ({ team_id, league_id: canonId, season: SEASON }));
    if (links.length) {
      const { error } = await s.from('team_leagues').upsert(links, { onConflict: 'team_id,league_id,season', ignoreDuplicates: true });
      if (error) throw new Error('team_leagues: ' + error.message);
    }
  }

  // 4) jogos (scoreboard por dia)
  const now = new Date().toISOString();
  const byEvent = new Map();
  let skipped = 0;
  for (const date of days(START, END)) {
    let j;
    try { j = await (await fetch(`${B}/scoreboard?dates=${date}`)).json(); } catch { continue; }
    for (const e of j?.events ?? []) {
      const comp = e.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find((c) => c.homeAway === 'home');
      const away = comp.competitors?.find((c) => c.homeAway === 'away');
      const hId = home?.team?.id ? teamIdByEspn.get(String(home.team.id)) : undefined;
      const aId = away?.team?.id ? teamIdByEspn.get(String(away.team.id)) : undefined;
      if (!hId || !aId || hId === aId || hId === '(novo)' || aId === '(novo)') { skipped++; continue; }
      const st = comp.status?.type ?? {};
      const hs = Number(home.score), as = Number(away.score);
      const hasScores = Number.isFinite(hs) && Number.isFinite(as);
      const status = mapStatus(st.state, st.completed, st.description, hasScores);
      const finished = status === 'finished';
      byEvent.set(e.id, { league_id: canonId, home_team_id: hId, away_team_id: aId, scheduled_at: e.date, status, home_score: finished ? hs : null, away_score: finished ? as : null, external_api_id: String(e.id), external_api_source: 'espn', last_synced_at: now, updated_at: now });
    }
  }
  const rows = [...byEvent.values()];
  console.log(`jogos: ${rows.length} resolvidos, ${skipped} pulados (seleção TBD/desconhecida)`);
  if (APPLY && typeof canonId === 'string' && canonId !== '(novo)' && rows.length) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await s.from('matches').upsert(rows.slice(i, i + 500), { onConflict: 'external_api_source,external_api_id' });
      if (error) throw new Error('matches: ' + error.message);
    }
  }

  console.log(APPLY ? 'Gravado.' : '(dry-run — nada gravado)');
}

main().catch((e) => { console.error(e); process.exit(1); });
