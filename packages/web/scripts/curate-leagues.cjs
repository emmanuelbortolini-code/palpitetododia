/*
 * Curadoria de ligas: marca as competições que mantemos (curated=true) e funde a
 * versão ESPN de cada uma na versão API-Football (canônica) via merged_into.
 * Não apaga nada. Requer migration 013.
 *
 * Uso: node scripts/curate-leagues.cjs [--apply]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');

// AF league id -> rótulo (as 13 competições curadas).
const CURATED_AF = {
  71: 'Série A', 72: 'Série B', 75: 'Série C', 76: 'Série D', 73: 'Copa do Brasil',
  612: 'Copa do Nordeste', 475: 'Paulista A1', 624: 'Carioca', 629: 'Mineiro',
  477: 'Gaúcho', 602: 'Baiano', 622: 'Pernambucano', 609: 'Cearense',
};
// ESPN slug -> AF league id correspondente (funde a ESPN na AF).
const ESPN_TO_AF = {
  'bra.1': 71, 'bra.2': 72, 'bra.3': 75, 'bra.copa_do_brazil': 73,
  'bra.camp.paulista': 475, 'bra.camp.carioca': 624,
  'bra.camp.mineiro': 629, 'bra.camp.gaucho': 477,
};

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => {
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: leagues, error } = await s
    .from('leagues')
    .select('id, name, external_api_source, external_api_id');
  if (error) throw new Error(error.message);

  const afById = new Map();
  const espnBySlug = new Map();
  for (const l of leagues) {
    if (l.external_api_source === 'api_football') afById.set(String(l.external_api_id), l);
    if (l.external_api_source === 'espn') espnBySlug.set(String(l.external_api_id), l);
  }

  // 1. Curadas (AF).
  const curatedRows = [];
  for (const afId of Object.keys(CURATED_AF)) {
    const l = afById.get(afId);
    if (l) curatedRows.push(l);
    else console.log(`  ! AF id ${afId} (${CURATED_AF[afId]}) não encontrada`);
  }
  console.log(`Curadas a marcar: ${curatedRows.length}/${Object.keys(CURATED_AF).length}`);

  // 2. Merge ESPN -> AF.
  const merges = [];
  for (const [slug, afId] of Object.entries(ESPN_TO_AF)) {
    const espn = espnBySlug.get(slug);
    const af = afById.get(String(afId));
    if (espn && af) merges.push({ espn, af });
    else console.log(`  ! merge ${slug} -> ${afId}: ${!espn ? 'ESPN ausente' : 'AF ausente'}`);
  }
  console.log(`ESPN a fundir na AF: ${merges.length}`);
  for (const m of merges) console.log(`   "${m.espn.name}" -> "${m.af.name}"`);

  if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply.'); return; }

  for (const l of curatedRows) {
    const { error: e } = await s.from('leagues').update({ curated: true }).eq('id', l.id);
    if (e) throw new Error(`curated ${l.name}: ${e.message}`);
  }
  for (const m of merges) {
    const { error: e } = await s.from('leagues').update({ merged_into: m.af.id }).eq('id', m.espn.id);
    if (e) throw new Error(`merge ${m.espn.name}: ${e.message}`);
  }
  console.log(`\nFeito. ${curatedRows.length} curadas, ${merges.length} ESPN fundidas.`);
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
