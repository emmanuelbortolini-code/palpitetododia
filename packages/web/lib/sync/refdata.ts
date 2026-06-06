import { createAdminClient } from '@/lib/supabase/admin';
import { fetchLeagues, fetchTeams } from '@/lib/api-football';

// Sync de dados de referência (ligas e times) via API-Football, independente do
// sync de partidas. Escreve com a service_role (ignora RLS).

const SOURCE = 'api_football';

function slugify(name: string, apiId: number): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return `${base || 'item'}-${apiId}`;
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

/** Sincroniza todas as ligas do Brasil (Série A/B/C/D, estaduais, etc.). */
export async function syncBrazilLeagues(): Promise<{ count: number }> {
  const supabase = createAdminClient();
  const leagues = await fetchLeagues('Brazil');
  if (!leagues.length) return { count: 0 };

  const countryId = await ensureBrazil(supabase);
  const now = new Date().toISOString();
  const rows = leagues.map((l) => ({
    country_id: countryId,
    name: l.league.name,
    slug: slugify(l.league.name, l.league.id),
    logo_url: l.league.logo,
    external_api_id: String(l.league.id),
    external_api_source: SOURCE,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('leagues')
    .upsert(rows, { onConflict: 'external_api_source,external_api_id' });
  if (error) throw new Error(`leagues: ${error.message}`);

  return { count: rows.length };
}

/** Sincroniza os times de uma liga (já cadastrada) numa temporada. */
export async function syncTeamsForLeague(
  leagueDbId: string,
  season: number,
): Promise<{ league: string; count: number; season: number }> {
  const supabase = createAdminClient();
  const { data: league, error: le } = await supabase
    .from('leagues')
    .select('id, name, country_id, external_api_id')
    .eq('id', leagueDbId)
    .single();
  if (le || !league) throw new Error('Liga não encontrada.');
  if (!league.external_api_id) throw new Error('Liga sem id da API-Football.');

  const teams = await fetchTeams(Number(league.external_api_id), season);
  if (!teams.length) return { league: league.name, count: 0, season };

  const now = new Date().toISOString();
  const rows = teams.map((t) => ({
    country_id: league.country_id,
    name: t.team.name,
    slug: slugify(t.team.name, t.team.id),
    logo_url: t.team.logo,
    external_api_id: String(t.team.id),
    external_api_source: SOURCE,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'external_api_source,external_api_id' });
  if (error) throw new Error(`teams: ${error.message}`);

  return { league: league.name, count: rows.length, season };
}
