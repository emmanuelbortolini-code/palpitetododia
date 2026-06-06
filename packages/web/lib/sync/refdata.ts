import { createAdminClient } from '@/lib/supabase/admin';
import { ESPN_BRAZIL_LEAGUES, fetchEspnLeagueTeams } from '@/lib/espn';

// Sync de dados de referência (ligas e times) via API pública da ESPN.
// Fonte 'espn'; escreve com a service_role (ignora RLS).

const SOURCE = 'espn';

function slugify(name: string, apiId: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return `${base || 'item'}-${SOURCE}-${apiId}`;
}

async function ensureBrazil(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await supabase
    .from('countries')
    .upsert({ code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷' }, { onConflict: 'code' })
    .select('id')
    .single();
  if (error) throw new Error(`countries: ${error.message}`);
  return data!.id;
}

/** Sincroniza as ligas brasileiras curadas (Série A/B/C, Copa do Brasil, estaduais). */
export async function syncBrazilLeagues(): Promise<{ count: number }> {
  const supabase = createAdminClient();
  const countryId = await ensureBrazil(supabase);
  const now = new Date().toISOString();

  const rows = [];
  for (const slug of ESPN_BRAZIL_LEAGUES) {
    const { league } = await fetchEspnLeagueTeams(slug);
    rows.push({
      country_id: countryId,
      name: league.name,
      slug: slugify(league.name, slug),
      logo_url: league.logo,
      external_api_id: slug, // o slug é a chave estável da ESPN
      external_api_source: SOURCE,
      updated_at: now,
    });
  }

  const { error } = await supabase
    .from('leagues')
    .upsert(rows, { onConflict: 'external_api_source,external_api_id' });
  if (error) throw new Error(`leagues: ${error.message}`);

  return { count: rows.length };
}
