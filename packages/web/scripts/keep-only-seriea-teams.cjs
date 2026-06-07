/*
 * Mantém apenas as 20 equipes da Série A (temporada atual) e suas linhas alias;
 * apaga o resto. Cascata remove jogos e vínculos das equipes excluídas.
 * Faz backup de teams antes.
 *
 * Uso: node scripts/keep-only-seriea-teams.cjs [--apply]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SEASON = new Date().getFullYear();

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

  // Liga Série A (AF id 71) e seus 20 times na temporada atual.
  const { data: la } = await s.from('leagues').select('id').eq('external_api_source', 'api_football').eq('external_api_id', '71').single();
  const { data: tl } = await s.from('team_leagues').select('team_id').eq('league_id', la.id).eq('season', SEASON);
  const canon = [...new Set((tl ?? []).map((t) => t.team_id))];

  // Aliases dos 20 (linhas merged_into apontando p/ eles).
  const { data: aliases } = await s.from('teams').select('id').in('merged_into', canon);
  const keep = new Set([...canon, ...(aliases ?? []).map((a) => a.id)]);

  const { count: totalTeams } = await s.from('teams').select('*', { count: 'exact', head: true });
  console.log(`Equipes hoje: ${totalTeams} | manter: ${keep.size} (${canon.length} canônicas + ${aliases?.length ?? 0} alias) | apagar: ${(totalTeams ?? 0) - keep.size}`);

  if (canon.length !== 20) {
    console.log(`\n⚠️  Esperava 20 canônicas da Série A, achei ${canon.length}. Abortando por segurança.`);
    return;
  }

  if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply.'); return; }

  // Backup.
  const { data: allTeams } = await s.from('teams').select('*');
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `teams-before-seriea-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(allTeams, null, 2));
  console.log(`Backup: ${file} (${allTeams.length} times)`);

  const keepList = [...keep];
  const { error } = await s.from('teams').delete().not('id', 'in', `(${keepList.join(',')})`);
  if (error) throw new Error(error.message);

  const { count: after } = await s.from('teams').select('*', { count: 'exact', head: true });
  const { count: matchesAfter } = await s.from('matches').select('*', { count: 'exact', head: true });
  console.log(`\nFeito. Equipes restantes: ${after} | jogos restantes: ${matchesAfter}.`);
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
