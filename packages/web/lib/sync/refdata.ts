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

export type EspnSyncResult = { leagues: number; teamLinks: number; skipped: number };

/**
 * Sincroniza, via ESPN, as ligas ATIVAS (curated) que têm contraparte ESPN.
 * Para cada uma: atualiza o snapshot espn_data (temporada atual + times) e os
 * vínculos time↔liga da temporada atual (ESPN é a única fonte com 2026).
 */
export async function syncEspnActiveLeagues(): Promise<EspnSyncResult> {
  const supabase = createAdminClient();
  const season = new Date().getFullYear();
  const now = new Date().toISOString();

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, curated, merged_into, external_api_source, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);

  // Liga ESPN (alias) de cada canônica.
  const espnAliasByCanon = new Map<string, { id: string; external_api_id: string }>();
  for (const l of leagues ?? []) {
    if (l.merged_into && l.external_api_source === SOURCE && l.external_api_id) {
      espnAliasByCanon.set(l.merged_into, { id: l.id, external_api_id: l.external_api_id });
    }
  }
  const activeCanon = (leagues ?? []).filter((l) => l.curated && !l.merged_into);

  // Time canônico por espn_id.
  const { data: teams } = await supabase.from('teams').select('id, espn_id, merged_into');
  const teamByEspn = new Map<string, string>();
  for (const t of teams ?? []) if (t.espn_id) teamByEspn.set(String(t.espn_id), t.merged_into ?? t.id);

  let leaguesSynced = 0;
  let skipped = 0;
  const linkSeen = new Set<string>();
  const linkRows: { team_id: string; league_id: string; season: number }[] = [];

  for (const c of activeCanon) {
    const alias = espnAliasByCanon.get(c.id);
    if (!alias) { skipped++; continue; } // sem contraparte ESPN (ex.: Série D)
    const { league, teams: roster } = await fetchEspnLeagueTeams(alias.external_api_id);
    const data = {
      name: league.name,
      slug: league.slug,
      logo: league.logo,
      season: league.season,
      teams: roster.map((t) => ({ id: t.id, name: t.name, logo: t.logo })),
    };
    await supabase.from('leagues').update({ espn_data: data, updated_at: now }).eq('id', alias.id);
    leaguesSynced++;
    for (const t of roster) {
      const teamId = teamByEspn.get(t.id);
      if (!teamId) continue;
      const k = `${teamId}|${c.id}|${season}`;
      if (linkSeen.has(k)) continue;
      linkSeen.add(k);
      linkRows.push({ team_id: teamId, league_id: c.id, season });
    }
  }

  if (linkRows.length) {
    const { error: le } = await supabase
      .from('team_leagues')
      .upsert(linkRows, { onConflict: 'team_id,league_id,season', ignoreDuplicates: true });
    if (le) throw new Error(`team_leagues: ${le.message}`);
  }

  return { leagues: leaguesSynced, teamLinks: linkRows.length, skipped };
}
