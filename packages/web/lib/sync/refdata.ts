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

/** Sincroniza os times de uma liga ESPN (já cadastrada), pelo slug guardado. */
export async function syncTeamsForLeague(
  leagueDbId: string,
): Promise<{ league: string; count: number }> {
  const supabase = createAdminClient();
  const { data: league, error: le } = await supabase
    .from('leagues')
    .select('id, name, country_id, external_api_id, external_api_source')
    .eq('id', leagueDbId)
    .single();
  if (le || !league) throw new Error('Liga não encontrada.');
  if (league.external_api_source !== SOURCE || !league.external_api_id) {
    throw new Error('Liga não é da fonte ESPN.');
  }

  const { teams } = await fetchEspnLeagueTeams(league.external_api_id);
  if (!teams.length) return { league: league.name, count: 0 };

  const now = new Date().toISOString();
  const rows = teams.map((t) => ({
    country_id: league.country_id,
    name: t.name,
    slug: slugify(t.name, t.id),
    logo_url: t.logo,
    external_api_id: t.id,
    external_api_source: SOURCE,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'external_api_source,external_api_id' });
  if (error) throw new Error(`teams: ${error.message}`);

  return { league: league.name, count: rows.length };
}
