import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTeams } from '@/lib/api-football';

// Sync de times via API-Football (única fonte com elenco por temporada + fundação
// + estádio). Fonte 'api_football'; escreve com a service_role (ignora RLS).

const SOURCE = 'api_football';

// Ligas brasileiras na API-Football e temporadas cobertas pelo plano free.
const LEAGUES = [
  { apiId: 71, name: 'Brasileirão Série A' },
  { apiId: 72, name: 'Brasileirão Série B' },
  { apiId: 75, name: 'Brasileirão Série C' },
  { apiId: 76, name: 'Brasileirão Série D' },
];
const SEASONS = [2022, 2023, 2024];

// Plano free da API-Football limita ~10 req/min; espaçamos as chamadas.
const THROTTLE_MS = 6500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(name: string, apiId: number | string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return `${base || 'item'}-${SOURCE}-${apiId}`;
}

export type SyncTeamsResult = { teams: number; links: number; requests: number };

/** Sincroniza todos os times das ligas brasileiras (Série A–D) nas temporadas cobertas. */
export async function syncAllTeams(): Promise<SyncTeamsResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: country, error: ce } = await supabase
    .from('countries')
    .upsert({ code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷' }, { onConflict: 'code' })
    .select('id')
    .single();
  if (ce) throw new Error(`countries: ${ce.message}`);
  const countryId = country!.id;

  const teamIds = new Set<string>();
  let links = 0;
  let requests = 0;
  let firstCall = true;

  for (const lg of LEAGUES) {
    // Garante a linha da liga (source api_football) para vincular team_leagues.
    const { data: league, error: le } = await supabase
      .from('leagues')
      .upsert(
        {
          country_id: countryId,
          name: lg.name,
          slug: slugify(lg.name, lg.apiId),
          external_api_id: String(lg.apiId),
          external_api_source: SOURCE,
          updated_at: now,
        },
        { onConflict: 'external_api_source,external_api_id' },
      )
      .select('id')
      .single();
    if (le) throw new Error(`leagues: ${le.message}`);
    const leagueId = league!.id;

    for (const season of SEASONS) {
      if (!firstCall) await sleep(THROTTLE_MS);
      firstCall = false;
      const apiTeams = await fetchTeams(lg.apiId, season);
      requests += 1;
      if (!apiTeams.length) continue;

      const rows = apiTeams.map((t) => ({
        country_id: countryId,
        name: t.team.name,
        slug: slugify(t.team.name, t.team.id),
        logo_url: t.team.logo,
        code: t.team.code,
        founded: t.team.founded,
        venue_name: t.venue?.name ?? null,
        venue_address: t.venue?.address ?? null,
        venue_city: t.venue?.city ?? null,
        venue_capacity: t.venue?.capacity ?? null,
        external_api_id: String(t.team.id),
        external_api_source: SOURCE,
        updated_at: now,
      }));

      const { data: upTeams, error: te } = await supabase
        .from('teams')
        .upsert(rows, { onConflict: 'external_api_source,external_api_id' })
        .select('id, external_api_id');
      if (te) throw new Error(`teams: ${te.message}`);

      const idByApi = new Map(upTeams!.map((t) => [t.external_api_id, t.id]));
      upTeams!.forEach((t) => teamIds.add(t.id));

      const linkRows = apiTeams
        .map((t) => idByApi.get(String(t.team.id)))
        .filter((id): id is string => !!id)
        .map((team_id) => ({ team_id, league_id: leagueId, season }));

      const { error: tle } = await supabase
        .from('team_leagues')
        .upsert(linkRows, { onConflict: 'team_id,league_id,season' });
      if (tle) throw new Error(`team_leagues: ${tle.message}`);
      links += linkRows.length;
    }
  }

  return { teams: teamIds.size, links, requests };
}
