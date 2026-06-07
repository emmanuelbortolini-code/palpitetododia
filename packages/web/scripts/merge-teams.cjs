/*
 * Auto-merge (reversível) de times duplicados entre fontes.
 * Junta SÓ pares sem ambiguidade: mesmo país + nome normalizado idêntico, com
 * exatamente 1 linha api_football e 1 linha espn. A linha ESPN vira ALIAS da
 * linha API-Football (canônica): seta merged_into = id da canônica. Nada é
 * apagado — desfazer é só limpar merged_into (na tela de match).
 * Casos duvidosos (nomes diferentes, ex.: Botafogo-RJ x Botafogo FC) ficam de
 * fora; vão para a tela de match.
 *
 * Uso:
 *   node scripts/merge-teams.cjs           # dry-run (só mostra o plano)
 *   node scripts/merge-teams.cjs --apply   # aplica (faz backup antes)
 *
 * Requer migrations 010 e 011 aplicadas.
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
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function main() {
  const { url, key } = loadEnv();
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local');
  const s = createClient(url, key);

  const { data: teams, error } = await s
    .from('teams')
    .select('id, country_id, name, api_football_id, espn_id, merged_into');
  if (error) throw new Error(error.message);

  if (APPLY) {
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `teams-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(teams, null, 2));
    console.log(`Backup: ${file} (${teams.length} times)`);
  }

  // Só linhas ainda não vinculadas entram no agrupamento.
  const free = teams.filter((t) => !t.merged_into);
  const groups = new Map();
  for (const t of free) {
    const k = `${t.country_id}::${norm(t.name)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }

  const merges = [];
  let ambiguous = 0;
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const af = rows.filter((r) => r.api_football_id && !r.espn_id);
    const espn = rows.filter((r) => r.espn_id && !r.api_football_id);
    if (af.length === 1 && espn.length === 1 && rows.length === 2) {
      merges.push({ canonical: af[0], alias: espn[0] });
    } else {
      ambiguous++;
    }
  }

  const afOnly = free.filter((t) => t.api_football_id && !t.espn_id).length;
  const espnOnly = free.filter((t) => t.espn_id && !t.api_football_id).length;
  const alreadyLinked = teams.filter((t) => t.merged_into).length;

  console.log(`\nTimes: ${teams.length} | já vinculados: ${alreadyLinked}`);
  console.log(`Livres -> api_football: ${afOnly} | espn: ${espnOnly}`);
  console.log(`Pares para vincular (sem ambiguidade): ${merges.length}`);
  console.log(`Grupos ambíguos (vão p/ tela de match): ${ambiguous}`);
  for (const m of merges.slice(0, 15)) {
    console.log(`   "${m.alias.name}" (espn ${m.alias.espn_id}) -> canônica "${m.canonical.name}" (af ${m.canonical.api_football_id})`);
  }
  if (merges.length > 15) console.log(`   ... +${merges.length - 15}`);

  if (!APPLY) {
    console.log('\nDRY-RUN. Reveja acima e rode com --apply para aplicar.');
    return;
  }

  let done = 0;
  for (const { canonical, alias } of merges) {
    const { error: ue } = await s
      .from('teams')
      .update({ merged_into: canonical.id, updated_at: new Date().toISOString() })
      .eq('id', alias.id);
    if (ue) throw new Error(`vincular ${alias.name}: ${ue.message}`);
    done++;
  }
  console.log(`\nFeito. ${done} pares vinculados. Restam ${espnOnly - done} espn livres para a tela de match.`);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
