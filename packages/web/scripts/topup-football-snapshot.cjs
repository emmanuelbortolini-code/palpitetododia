/*
 * Top-up dos snapshots api_football_data: ADICIONA os 3 campos que faltavam para
 * paridade total com o endpoint /teams (country, national, venue_id), mantendo o
 * formato plano e TODOS os campos já existentes (não toca em link/unlinkProvider).
 *
 * Uso:
 *   node scripts/topup-football-snapshot.cjs           # dry-run (consulta, não grava)
 *   node scripts/topup-football-snapshot.cjs --apply
 *
 * Cada time = 1 requisição (plano Free 100/dia, ~10/min). O snapshot vive na linha
 * que tem o api_football_id (canônica ou alias).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => {
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
    afBase: get('API_FOOTBALL_BASE_URL') || 'https://v3.football.api-sports.io',
    afKey: get('API_FOOTBALL_KEY'),
  };
}

async function main() {
  const { url, key, afBase, afKey } = loadEnv();
  if (!afKey) throw new Error('Sem API_FOOTBALL_KEY em .env.local');
  const s = createClient(url, key);

  const { data: teams, error } = await s
    .from('teams')
    .select('id, name, api_football_id, api_football_data')
    .not('api_football_id', 'is', null);
  if (error) throw new Error(error.message);
  console.log(`Times com api_football_id: ${teams.length}${APPLY ? '' : ' (dry-run)'}\n`);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let updated = 0;
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    let j;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`${afBase}/teams?id=${t.api_football_id}`, { headers: { 'x-apisports-key': afKey } });
      j = await r.json();
      const rate = j.errors && (j.errors.rateLimit || j.errors.requests);
      if (rate && attempt === 0) { console.log('  rate limit, aguardando 60s…'); await sleep(60000); continue; }
      break;
    }
    const err = j.errors && Object.keys(j.errors).length ? JSON.stringify(j.errors) : '';
    if (err) { console.log(`  ${t.name}: ERRO ${err}`); continue; }
    const x = (j.response ?? [])[0];
    if (!x) { console.log(`  ${t.name}: sem resposta`); continue; }

    const snap = { ...(t.api_football_data ?? {}) };
    snap.country = x.team?.country ?? null;
    snap.national = x.team?.national ?? null;
    snap.venue_id = x.venue?.id ?? null;
    console.log(`  ${t.name}: country=${snap.country} national=${snap.national} venue_id=${snap.venue_id}`);

    if (APPLY) {
      const { error: ue } = await s
        .from('teams')
        .update({ api_football_data: snap, updated_at: new Date().toISOString() })
        .eq('id', t.id);
      if (ue) { console.log(`    ERRO update: ${ue.message}`); continue; }
      updated++;
    }
    if (i < teams.length - 1) await sleep(6500); // ~9/min, abaixo do teto
  }

  console.log(`\n${APPLY ? `Atualizados: ${updated}` : 'Dry-run: nada gravado. Rode com --apply.'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
