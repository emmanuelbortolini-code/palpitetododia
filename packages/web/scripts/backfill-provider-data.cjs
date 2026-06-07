/*
 * Backfill dos snapshots brutos (api_football_data / espn_data) a partir do que
 * já temos hoje. A linha com api_football_id recebe o snapshot dos campos ricos
 * (vieram do API-Football); a linha com espn_id recebe nome+logo (o que a ESPN dá).
 * Idempotente: só preenche onde está NULL.
 *
 * Uso:
 *   node scripts/backfill-provider-data.cjs           # dry-run
 *   node scripts/backfill-provider-data.cjs --apply
 *
 * Requer migration 012 aplicada.
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

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: teams, error } = await s
    .from('teams')
    .select(
      'id, api_football_id, espn_id, api_football_data, espn_data, name, code, logo_url, founded, venue_name, venue_address, venue_city, venue_capacity, website',
    );
  if (error) throw new Error(error.message);

  let af = 0;
  let espn = 0;
  for (const t of teams) {
    const upd = {};
    if (t.api_football_id && t.api_football_data == null) {
      upd.api_football_data = {
        name: t.name,
        code: t.code ?? null,
        logo_url: t.logo_url ?? null,
        founded: t.founded ?? null,
        venue_name: t.venue_name ?? null,
        venue_address: t.venue_address ?? null,
        venue_city: t.venue_city ?? null,
        venue_capacity: t.venue_capacity ?? null,
        website: t.website ?? null,
      };
      af++;
    }
    if (t.espn_id && t.espn_data == null) {
      upd.espn_data = { name: t.name, logo_url: t.logo_url ?? null };
      espn++;
    }
    if (APPLY && Object.keys(upd).length) {
      const { error: ue } = await s.from('teams').update(upd).eq('id', t.id);
      if (ue) throw new Error(`update ${t.id}: ${ue.message}`);
    }
  }

  console.log(`Snapshots ${APPLY ? 'gravados' : 'a gravar'}: api_football_data=${af}, espn_data=${espn}`);
  if (!APPLY) console.log('DRY-RUN. Rode com --apply para gravar.');
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
