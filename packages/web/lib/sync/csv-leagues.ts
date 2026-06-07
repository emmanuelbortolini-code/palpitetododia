import { parse } from 'csv-parse/sync';
import { createAdminClient } from '@/lib/supabase/admin';

// Importa um CSV (formato do export, #dados/brazil-serie-d-league-data.csv) para
// ATUALIZAR ligas em massa. Casa cada linha pelo ID (external_api_id, o mesmo que
// o export emite). Campos de país são da tabela countries → ignorados aqui.

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

type Mapping = { csv: string; col: string; read: (raw: string | undefined) => unknown };
const MAPPINGS: Mapping[] = [
  { csv: 'Name (BR)', col: 'name', read: (v) => (v ?? '').trim() || null },
  { csv: 'Name (EN)', col: 'name_en', read: (v) => (v ?? '').trim() || null },
  { csv: 'Name (ES)', col: 'name_es', read: (v) => (v ?? '').trim() || null },
  { csv: 'Slug (BR)', col: 'slug', read: (v) => (v ?? '').trim() || null },
  { csv: 'Slug (EN)', col: 'slug_en', read: (v) => (v ?? '').trim() || null },
  { csv: 'Slug (ES)', col: 'slug_es', read: (v) => (v ?? '').trim() || null },
  { csv: 'Nicknames (EN)', col: 'nicknames_en', read: parseNicknames },
  { csv: 'Nicknames (BR)', col: 'nicknames_pt', read: parseNicknames },
  { csv: 'Nicknames (ES)', col: 'nicknames_es', read: parseNicknames },
  { csv: 'Gender (EN)', col: 'gender_en', read: (v) => (v ?? '').trim() || null },
  { csv: 'Gender (BR)', col: 'gender_br', read: (v) => (v ?? '').trim() || null },
  { csv: 'Gender (ES)', col: 'gender_es', read: (v) => (v ?? '').trim() || null },
  { csv: 'Logo (WEBP)', col: 'logo_url', read: (v) => (v ?? '').trim() || null },
];

export type CsvLeagueImportResult = { updated: number; skipped: number; skippedIds: string[] };

export async function importLeaguesFromCsv(text: string): Promise<CsvLeagueImportResult> {
  const records = parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Record<string, string>[];
  if (!records.length) return { updated: 0, skipped: 0, skippedIds: [] };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: leagues, error } = await supabase.from('leagues').select('id, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);
  const byId = new Map<string, string>();
  for (const l of leagues ?? []) if (l.external_api_id) byId.set(String(l.external_api_id), l.id);

  let updated = 0;
  const skippedIds: string[] = [];
  for (const r of records) {
    const id = String(r['ID'] ?? '').trim();
    const leagueId = id ? byId.get(id) : undefined;
    if (!leagueId) {
      if (id) skippedIds.push(id);
      continue;
    }
    const upd: Record<string, unknown> = { updated_at: now };
    for (const m of MAPPINGS) {
      if (!(m.csv in r)) continue;
      const val = m.read(r[m.csv]);
      if (val === null || val === '') continue;
      upd[m.col] = val;
    }
    if (Object.keys(upd).length === 1) continue;
    const { error: ue } = await supabase.from('leagues').update(upd).eq('id', leagueId);
    if (ue) throw new Error(`update ${id}: ${ue.message}`);
    updated++;
  }

  return { updated, skipped: skippedIds.length, skippedIds };
}
