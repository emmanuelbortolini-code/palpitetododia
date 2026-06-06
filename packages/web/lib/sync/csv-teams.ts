import { parse } from 'csv-parse/sync';
import { createAdminClient } from '@/lib/supabase/admin';

// Importa equipes de um CSV no formato de referência
// (#dados/brazil-serie-a-2026-teams.csv). Fonte 'csv'; service-role.

const SOURCE = 'csv';

function leagueSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return `${base || 'liga'}-${SOURCE}`;
}

// Apelidos no CSV: JSON array de {value, gender} (ou strings). Extrai os valores.
function parseNicknames(raw: string | undefined): string[] | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return null;
    const vals = arr
      .map((x) => (typeof x === 'string' ? x : x?.value))
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    return vals.length ? vals : null;
  } catch {
    return null;
  }
}

function opt(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return s || null;
}

export type CsvImportResult = { teams: number; links: number };

export async function importTeamsFromCsv(
  text: string,
  opts: { leagueName?: string; season?: number },
): Promise<CsvImportResult> {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
  if (!records.length) return { teams: 0, links: 0 };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // CSV de referência é do Brasil.
  const { data: country, error: ce } = await supabase
    .from('countries')
    .upsert({ code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷' }, { onConflict: 'code' })
    .select('id')
    .single();
  if (ce) throw new Error(`countries: ${ce.message}`);
  const countryId = country!.id;

  // Liga (opcional) para vincular temporada → habilita os filtros liga/temporada.
  let leagueId: string | null = null;
  if (opts.leagueName) {
    const slug = leagueSlug(opts.leagueName);
    const { data: lg, error: le } = await supabase
      .from('leagues')
      .upsert(
        {
          country_id: countryId,
          name: opts.leagueName,
          slug,
          external_api_id: slug,
          external_api_source: SOURCE,
          updated_at: now,
        },
        { onConflict: 'external_api_source,external_api_id' },
      )
      .select('id')
      .single();
    if (le) throw new Error(`leagues: ${le.message}`);
    leagueId = lg!.id;
  }

  const rows = records.map((r) => {
    const id = String(r['ID'] ?? '').trim();
    const nameBr = opt(r['Name (BR)']) ?? opt(r['Name (EN)']) ?? 'Time';
    const slugBr = opt(r['Slug (BR)']) ?? nameBr.toLowerCase();
    return {
      country_id: countryId,
      name: nameBr,
      name_en: opt(r['Name (EN)']),
      name_es: opt(r['Name (ES)']),
      slug: `${slugBr}-${SOURCE}-${id}`,
      slug_en: opt(r['Slug (EN)']),
      slug_es: opt(r['Slug (ES)']),
      founded: r['Founded Year'] ? Number(r['Founded Year']) || null : null,
      venue_name: opt(r['Stadium Name']),
      venue_address: opt(r['Stadium Address']),
      website: opt(r['Official Sites']),
      logo_url: opt(r['Logo Image (WEBP)']),
      nicknames_pt: parseNicknames(r['Nicknames (BR)']),
      nicknames_en: parseNicknames(r['Nicknames (EN)']),
      nicknames_es: parseNicknames(r['Nicknames (ES)']),
      gender: opt(r['Gender (BR)']) ?? opt(r['Gender (EN)']),
      external_api_id: id,
      external_api_source: SOURCE,
      updated_at: now,
    };
  });

  const { data: up, error: te } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'external_api_source,external_api_id' })
    .select('id, external_api_id');
  if (te) throw new Error(`teams: ${te.message}`);

  let links = 0;
  if (leagueId && opts.season) {
    const idByApi = new Map(up!.map((t) => [t.external_api_id, t.id]));
    const linkRows = rows
      .map((r) => idByApi.get(r.external_api_id))
      .filter((id): id is string => !!id)
      .map((team_id) => ({ team_id, league_id: leagueId!, season: opts.season! }));
    const { error: tle } = await supabase
      .from('team_leagues')
      .upsert(linkRows, { onConflict: 'team_id,league_id,season' });
    if (tle) throw new Error(`team_leagues: ${tle.message}`);
    links = linkRows.length;
  }

  return { teams: rows.length, links };
}
