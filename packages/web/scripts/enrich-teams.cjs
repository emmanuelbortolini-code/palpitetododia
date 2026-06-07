/*
 * Enriquece os times via endpoint /teams do API-Football (temporada 2024, único
 * limite do plano Free). Para cada time da liga:
 *   - se já existe (por api_football_id): grava o snapshot bruto em
 *     api_football_data e PREENCHE os campos vazios da linha canônica (sem tocar
 *     no que foi editado à mão / overrides);
 *   - se não existe: INSERE como novo time canônico.
 * Casamento ESPN↔API-Football fica para a tela "Times para Vincular".
 *
 * Uso:
 *   node scripts/enrich-teams.cjs           # dry-run (consulta a API, não grava)
 *   node scripts/enrich-teams.cjs --apply
 *
 * Requer migrations 010/012 aplicadas. Cada liga = 1 requisição (plano Free 100/dia).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SEASON = 2024; // teto do plano Free

// Nacionais + Nordeste + estaduais grandes (1ª divisão).
const LEAGUES = [
  [71, 'Série A'], [72, 'Série B'], [75, 'Série C'], [76, 'Série D'],
  [73, 'Copa do Brasil'], [612, 'Copa do Nordeste'],
  [475, 'Paulista A1'], [624, 'Carioca'], [629, 'Mineiro'], [477, 'Gaúcho'],
  [602, 'Baiano'], [622, 'Pernambucano'], [609, 'Cearense'],
];

// Campos editáveis que preenchemos se estiverem vazios (e não em overrides).
const FILL_COLS = ['name', 'code', 'logo_url', 'founded', 'venue_name', 'venue_address', 'venue_city', 'venue_capacity'];

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

const slugify = (name) =>
  (name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110) || 'time');

function toSnapshot(x) {
  return {
    name: x.team.name,
    code: x.team.code ?? null,
    logo_url: x.team.logo ?? null,
    founded: x.team.founded ?? null,
    venue_name: x.venue?.name ?? null,
    venue_address: x.venue?.address ?? null,
    venue_city: x.venue?.city ?? null,
    venue_capacity: x.venue?.capacity ?? null,
    venue_surface: x.venue?.surface ?? null,
    venue_image: x.venue?.image ?? null,
  };
}

async function main() {
  const { url, key, afBase, afKey } = loadEnv();
  if (!afKey) throw new Error('Sem API_FOOTBALL_KEY em .env.local');
  const s = createClient(url, key);

  // 1. Coleta os times de cada liga (dedupe por api_football_id).
  // Plano Free tem limite por minuto (~10/min): espaça as chamadas e re-tenta no rate limit.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byApi = new Map();
  for (let i = 0; i < LEAGUES.length; i++) {
    const [id, name] = LEAGUES[i];
    let j;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`${afBase}/teams?league=${id}&season=${SEASON}`, { headers: { 'x-apisports-key': afKey } });
      j = await r.json();
      const rate = j.errors && (j.errors.rateLimit || j.errors.requests);
      if (rate && attempt === 0) { console.log(`  ${name}: rate limit, aguardando 60s…`); await sleep(60000); continue; }
      break;
    }
    const err = j.errors && Object.keys(j.errors).length ? JSON.stringify(j.errors) : '';
    if (err) { console.log(`  ${name}: ERRO ${err}`); continue; }
    for (const x of j.response ?? []) byApi.set(String(x.team.id), x);
    console.log(`  ${name}: ${j.results} times`);
    if (i < LEAGUES.length - 1) await sleep(6500); // ~9/min, abaixo do teto
  }
  console.log(`\nTimes únicos coletados: ${byApi.size}`);

  // 2. Estado atual.
  const { data: teams, error } = await s
    .from('teams')
    .select(`id, api_football_id, merged_into, overrides, ${FILL_COLS.join(', ')}`);
  if (error) throw new Error(error.message);
  const rowByApi = new Map();
  const byId = new Map();
  for (const t of teams) {
    byId.set(t.id, t);
    if (t.api_football_id) rowByApi.set(String(t.api_football_id), t);
  }

  // País Brasil (para inserts).
  let countryId = null;
  if (APPLY) {
    const { data: c, error: ce } = await s
      .from('countries')
      .upsert({ code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷' }, { onConflict: 'code' })
      .select('id').single();
    if (ce) throw new Error(`countries: ${ce.message}`);
    countryId = c.id;
  }

  let inserted = 0, enriched = 0, filledFields = 0;
  for (const [apiId, x] of byApi) {
    const snap = toSnapshot(x);
    const existing = rowByApi.get(apiId);

    if (existing) {
      enriched++;
      if (!APPLY) continue;
      // snapshot bruto na própria linha que tem o api_football_id
      await s.from('teams').update({ api_football_data: snap, updated_at: new Date().toISOString() }).eq('id', existing.id);
      // preenche vazios na canônica (resolve merged_into)
      const canon = existing.merged_into ? byId.get(existing.merged_into) : existing;
      if (canon) {
        const ov = new Set(Array.isArray(canon.overrides) ? canon.overrides : []);
        const fill = {};
        for (const col of FILL_COLS) {
          const cur = canon[col];
          const empty = cur === null || cur === undefined || cur === '';
          if (empty && !ov.has(col) && snap[col] != null && snap[col] !== '') fill[col] = snap[col];
        }
        if (Object.keys(fill).length) {
          filledFields += Object.keys(fill).length;
          await s.from('teams').update({ ...fill, updated_at: new Date().toISOString() }).eq('id', canon.id);
        }
      }
    } else {
      inserted++;
      if (!APPLY) continue;
      const { error: ie } = await s.from('teams').insert({
        country_id: countryId,
        name: snap.name,
        slug: `${slugify(snap.name)}-af-${apiId}`,
        code: snap.code,
        logo_url: snap.logo_url,
        founded: snap.founded,
        venue_name: snap.venue_name,
        venue_address: snap.venue_address,
        venue_city: snap.venue_city,
        venue_capacity: snap.venue_capacity,
        api_football_id: apiId,
        api_football_data: snap,
      });
      if (ie) throw new Error(`insert ${snap.name}: ${ie.message}`);
    }
  }

  console.log(`\n${APPLY ? 'Aplicado' : 'Dry-run'}: ${enriched} já existentes enriquecidos${APPLY ? ` (${filledFields} campos preenchidos)` : ''}, ${inserted} novos clubes ${APPLY ? 'inseridos' : 'a inserir'}.`);
  if (!APPLY) console.log('Rode com --apply para gravar.');
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
