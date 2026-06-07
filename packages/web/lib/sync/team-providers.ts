import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnLeagueTeams } from '@/lib/espn';

const SEASON = new Date().getFullYear();

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (name: string) =>
  norm(name).replace(/ /g, '-').slice(0, 110) || 'time';

async function ensureBrazil(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await supabase
    .from('countries')
    .upsert({ code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷' }, { onConflict: 'code' })
    .select('id')
    .single();
  if (error) throw new Error(`countries: ${error.message}`);
  return data!.id;
}

export type EspnTeamsResult = { leagues: number; created: number; updated: number; links: number; skipped: number };

/**
 * Botão "Sincronizar Equipes da API ESPN": para cada liga ATIVA com contraparte
 * ESPN, traz o elenco atual — cria times que faltam (com espn_data), atualiza o
 * espn_data dos existentes e vincula à temporada atual (team_leagues).
 */
export async function syncEspnActiveTeams(): Promise<EspnTeamsResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const countryId = await ensureBrazil(supabase);

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, curated, merged_into, external_api_source, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);
  const espnAliasByCanon = new Map<string, string>(); // canon league id -> espn slug
  for (const l of leagues ?? []) {
    if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) espnAliasByCanon.set(l.merged_into, l.external_api_id);
  }
  const activeCanon = (leagues ?? []).filter((l) => l.curated && !l.merged_into);

  const { data: teams } = await supabase.from('teams').select('id, espn_id, merged_into');
  const rowByEspn = new Map<string, { id: string; merged_into: string | null }>();
  for (const t of teams ?? []) if (t.espn_id) rowByEspn.set(String(t.espn_id), t);

  let leaguesDone = 0, created = 0, updated = 0, skipped = 0;
  const linkSeen = new Set<string>();
  const linkRows: { team_id: string; league_id: string; season: number }[] = [];

  for (const c of activeCanon) {
    const slug = espnAliasByCanon.get(c.id);
    if (!slug) { skipped++; continue; }
    const { teams: roster } = await fetchEspnLeagueTeams(slug);
    leaguesDone++;
    for (const t of roster) {
      const snap = { name: t.name, logo_url: t.logo };
      let canonId: string;
      const ex = rowByEspn.get(t.id);
      if (ex) {
        await supabase.from('teams').update({ espn_data: snap, updated_at: now }).eq('id', ex.id);
        canonId = ex.merged_into ?? ex.id;
        updated++;
      } else {
        const { data: ins, error: ie } = await supabase
          .from('teams')
          .insert({
            country_id: countryId,
            name: t.name,
            slug: `${slugify(t.name)}-espn-${t.id}`,
            logo_url: t.logo,
            espn_id: t.id,
            espn_data: snap,
          })
          .select('id')
          .single();
        if (ie) throw new Error(`insert ${t.name}: ${ie.message}`);
        canonId = ins!.id;
        rowByEspn.set(t.id, { id: canonId, merged_into: null });
        created++;
      }
      const k = `${canonId}|${c.id}|${SEASON}`;
      if (!linkSeen.has(k)) { linkSeen.add(k); linkRows.push({ team_id: canonId, league_id: c.id, season: SEASON }); }
    }
  }

  if (linkRows.length) {
    const { error: le } = await supabase
      .from('team_leagues')
      .upsert(linkRows, { onConflict: 'team_id,league_id,season', ignoreDuplicates: true });
    if (le) throw new Error(`team_leagues: ${le.message}`);
  }

  return { leagues: leaguesDone, created, updated, links: linkRows.length, skipped };
}

export type FootballFillResult = { matched: number; skipped: number; remaining: number };

// Snapshot bruto do AF (mesma forma do enrich-teams).
function afSnapshot(x: { team: Record<string, unknown>; venue: Record<string, unknown> | null }) {
  const t = x.team, v = x.venue || {};
  return {
    name: t.name, code: t.code ?? null, logo_url: t.logo ?? null, founded: t.founded ?? null,
    venue_name: v.name ?? null, venue_address: v.address ?? null, venue_city: v.city ?? null,
    venue_capacity: v.capacity ?? null, venue_surface: v.surface ?? null, venue_image: v.image ?? null,
  };
}

/**
 * Botão "Sincronizar Equipes da API FOOTBALL": completa os times que vieram da
 * ESPN e ainda não têm dados do Football. Busca por nome no API-Football, casa
 * por nome (Brasil) e preenche só o que falta. Processa em lote (limite/min do
 * plano Free) — clique de novo para continuar.
 */
export async function syncFootballMissingTeams(limit = 9): Promise<FootballFillResult> {
  const supabase = createAdminClient();
  const afBase = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';
  const afKey = process.env.API_FOOTBALL_KEY!;
  const now = new Date().toISOString();

  const FILL = ['code', 'founded', 'venue_name', 'venue_address', 'venue_city', 'venue_capacity', 'logo_url'];

  // Times canônicos só-ESPN sem dados AF.
  const { data: missing } = await supabase
    .from('teams')
    .select(`id, name, ${FILL.join(', ')}`)
    .is('merged_into', null)
    .not('espn_id', 'is', null)
    .is('api_football_id', null)
    .is('api_football_data', null)
    .order('name', { ascending: true });
  const all = (missing ?? []) as unknown as Record<string, unknown>[];
  const remaining = Math.max(0, all.length - limit);

  // Ids AF já usados (evita violar a unicidade / duplicar).
  const { data: used } = await supabase.from('teams').select('api_football_id').not('api_football_id', 'is', null);
  const usedAf = new Set((used ?? []).map((u) => String(u.api_football_id)));

  let matched = 0, skipped = 0;
  for (const team of all.slice(0, limit)) {
    const name = String(team.name);
    const r = await fetch(`${afBase}/teams?search=${encodeURIComponent(name)}`, { headers: { 'x-apisports-key': afKey } });
    const j = await r.json();
    if (j.errors && (j.errors.rateLimit || j.errors.requests)) break; // atingiu limite/min: para o lote
    const cands = (j.response ?? []).filter((x: any) => x.team?.country === 'Brazil');
    const hit = cands.find((x: any) => norm(x.team.name) === norm(name));
    if (!hit || usedAf.has(String(hit.team.id))) { skipped++; continue; }

    const snap = afSnapshot(hit);
    const upd: Record<string, unknown> = { api_football_id: String(hit.team.id), api_football_data: snap, updated_at: now };
    for (const c of FILL) {
      const cur = team[c];
      if ((cur === null || cur === undefined || cur === '') && (snap as Record<string, unknown>)[c] != null) upd[c] = (snap as Record<string, unknown>)[c];
    }
    const { error: ue } = await supabase.from('teams').update(upd).eq('id', team.id);
    if (ue) throw new Error(`update ${name}: ${ue.message}`);
    usedAf.add(String(hit.team.id));
    matched++;
  }

  return { matched, skipped, remaining };
}
