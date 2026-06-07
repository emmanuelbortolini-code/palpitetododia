import { createAdminClient } from '@/lib/supabase/admin';
import { fetchFixtures, type ApiFixture } from '@/lib/api-football';

const LEAGUE_ID = Number(process.env.API_FOOTBALL_LEAGUE_ID ?? 71); // Brasileirão Série A
const SEASON = Number(process.env.API_FOOTBALL_SEASON ?? new Date().getFullYear());
const SOURCE = 'api_football';

export type SyncResult = {
  league: string | null;
  teams: number;
  matches: number;
  season: number;
};

function slugify(name: string, apiId: number): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  // Sufixo determinístico com o id da API garante slug único e estável entre syncs.
  return `${base || 'item'}-${apiId}`;
}

// Mapeia o status curto da API-Football para o CHECK da coluna matches.status.
function mapStatus(short: string): string {
  if (['NS', 'TBD'].includes(short)) return 'scheduled';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'].includes(short))
    return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (short === 'PST') return 'postponed';
  return 'cancelled'; // CANC, ABD, AWD, WO, etc.
}

/**
 * Sincroniza a liga configurada (Brasileirão por padrão) da temporada configurada:
 * upsert de país → liga → times → partidas, por (external_api_source, external_api_id).
 * Usa a service_role (ignora RLS) — as tabelas de referência só aceitam escrita assim.
 */
export async function syncMatches(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const fixtures = await fetchFixtures(LEAGUE_ID, SEASON);
  if (!fixtures.length) {
    return { league: null, teams: 0, matches: 0, season: SEASON };
  }

  const now = new Date().toISOString();

  // 1. País (Brasil). countries.code é único.
  const { data: country, error: countryErr } = await supabase
    .from('countries')
    .upsert({ code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷' }, { onConflict: 'code' })
    .select('id')
    .single();
  if (countryErr) throw new Error(`countries: ${countryErr.message}`);
  const countryId = country!.id;

  // 2. Liga (lida da primeira fixture — todas têm a mesma).
  const lg = fixtures[0].league;
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .upsert(
      {
        country_id: countryId,
        name: lg.name,
        slug: slugify(lg.name, lg.id),
        logo_url: lg.logo,
        external_api_id: String(lg.id),
        external_api_source: SOURCE,
        updated_at: now,
      },
      { onConflict: 'external_api_source,external_api_id' },
    )
    .select('id')
    .single();
  if (leagueErr) throw new Error(`leagues: ${leagueErr.message}`);
  const leagueId = league!.id;

  // 3. Times (identidade por api_football_id).
  const teamsByApi = new Map<number, ApiFixture['teams']['home']>();
  for (const f of fixtures) {
    teamsByApi.set(f.teams.home.id, f.teams.home);
    teamsByApi.set(f.teams.away.id, f.teams.away);
  }
  const apiIds = [...teamsByApi.keys()].map(String);

  // Linhas já existentes: atualizamos só os campos NÃO marcados em `overrides`
  // (o staff pode ter editado à mão) e mapeamos para a linha canônica se foi
  // vinculada (merged_into) — assim os jogos apontam para o time visível.
  const { data: existing, error: exErr } = await supabase
    .from('teams')
    .select('id, api_football_id, overrides, merged_into')
    .in('api_football_id', apiIds);
  if (exErr) throw new Error(`teams (lookup): ${exErr.message}`);
  const existingByApi = new Map((existing ?? []).map((t) => [t.api_football_id, t]));

  const teamIdByApi = new Map<string, string>();
  const toInsert: Record<string, unknown>[] = [];
  for (const t of teamsByApi.values()) {
    const apiId = String(t.id);
    const ex = existingByApi.get(apiId);
    if (ex) {
      teamIdByApi.set(apiId, ex.merged_into ?? ex.id);
      const ov = new Set(Array.isArray(ex.overrides) ? (ex.overrides as string[]) : []);
      const upd: Record<string, unknown> = { updated_at: now };
      if (!ov.has('name')) upd.name = t.name;
      if (!ov.has('logo_url')) upd.logo_url = t.logo;
      if (Object.keys(upd).length > 1) {
        const { error } = await supabase.from('teams').update(upd).eq('id', ex.id);
        if (error) throw new Error(`teams (update): ${error.message}`);
      }
    } else {
      toInsert.push({
        country_id: countryId,
        name: t.name,
        slug: slugify(t.name, t.id),
        logo_url: t.logo,
        api_football_id: apiId,
        api_football_data: { name: t.name, logo_url: t.logo },
        updated_at: now,
      });
    }
  }
  if (toInsert.length) {
    const { data: ins, error } = await supabase
      .from('teams')
      .insert(toInsert)
      .select('id, api_football_id');
    if (error) throw new Error(`teams (insert): ${error.message}`);
    for (const r of ins!) teamIdByApi.set(r.api_football_id, r.id);
  }

  // 4. Partidas.
  const matchRows = fixtures.map((f) => {
    let status = mapStatus(f.fixture.status.short);
    const hasScores = f.goals.home != null && f.goals.away != null;
    // valid_score: finished EXIGE os dois placares; sem placar tratamos como cancelada.
    if (status === 'finished' && !hasScores) status = 'cancelled';
    const finished = status === 'finished';
    return {
      league_id: leagueId,
      home_team_id: teamIdByApi.get(String(f.teams.home.id)),
      away_team_id: teamIdByApi.get(String(f.teams.away.id)),
      scheduled_at: f.fixture.date,
      status,
      home_score: finished ? f.goals.home : null,
      away_score: finished ? f.goals.away : null,
      home_team_slug: slugify(f.teams.home.name, f.teams.home.id),
      away_team_slug: slugify(f.teams.away.name, f.teams.away.id),
      external_api_id: String(f.fixture.id),
      external_api_source: SOURCE,
      last_synced_at: now,
      updated_at: now,
    };
  });
  const { error: matchesErr } = await supabase
    .from('matches')
    .upsert(matchRows, { onConflict: 'external_api_source,external_api_id' });
  if (matchesErr) throw new Error(`matches: ${matchesErr.message}`);

  return {
    league: lg.name,
    teams: teamsByApi.size,
    matches: matchRows.length,
    season: SEASON,
  };
}
