import { parse } from 'csv-parse/sync';
import { createAdminClient } from '@/lib/supabase/admin';

// Importa um CSV (no mesmo formato do export, #dados/brazil-serie-a-2026-teams.csv)
// para ATUALIZAR dados de times em massa. Casa cada linha pelo ID (api_football_id
// ou espn_id, o mesmo que o export emite). Os campos preenchidos viram `overrides`
// — passam a ter prioridade e o sync não os sobrescreve. service-role.

// Apelidos no CSV: JSON array de {value, gender} (ou strings). Preserva o gênero
// por apelido (formato canônico do banco: [{value, gender}]).
type Nick = { value: string; gender?: string | null };
function parseNicknames(raw: string | undefined): Nick[] | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return null;
    const out: Nick[] = [];
    for (const x of arr) {
      if (typeof x === 'string') {
        if (x) out.push({ value: x });
      } else if (x && typeof x.value === 'string' && x.value) {
        const g = typeof x.gender === 'string' ? x.gender.trim() : '';
        out.push(g ? { value: x.value, gender: g } : { value: x.value });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function optInt(v: string | undefined): number | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Coluna do CSV -> coluna do banco. Só campos editáveis e seguros (não mexe no
// slug canônico nem no country_id). Cada um traz como ler o valor.
type Mapping = { csv: string; col: string; read: (raw: string | undefined) => unknown };
const MAPPINGS: Mapping[] = [
  { csv: 'Name (BR)', col: 'name', read: (v) => (v ?? '').trim() || null },
  { csv: 'Name (EN)', col: 'name_en', read: (v) => (v ?? '').trim() || null },
  { csv: 'Name (ES)', col: 'name_es', read: (v) => (v ?? '').trim() || null },
  { csv: 'Slug (EN)', col: 'slug_en', read: (v) => (v ?? '').trim() || null },
  { csv: 'Slug (ES)', col: 'slug_es', read: (v) => (v ?? '').trim() || null },
  { csv: 'Founded Year', col: 'founded', read: optInt },
  { csv: 'Stadium Name', col: 'venue_name', read: (v) => (v ?? '').trim() || null },
  { csv: 'Stadium Address', col: 'venue_address', read: (v) => (v ?? '').trim() || null },
  { csv: 'Stadium City', col: 'venue_city', read: (v) => (v ?? '').trim() || null },
  { csv: 'Stadium Capacity', col: 'venue_capacity', read: optInt },
  { csv: 'Official Sites', col: 'website', read: (v) => (v ?? '').trim() || null },
  { csv: 'Nicknames (EN)', col: 'nicknames_en', read: parseNicknames },
  { csv: 'Nicknames (BR)', col: 'nicknames_pt', read: parseNicknames },
  { csv: 'Nicknames (ES)', col: 'nicknames_es', read: parseNicknames },
  { csv: 'Gender (EN)', col: 'gender_en', read: (v) => (v ?? '').trim() || null },
  { csv: 'Gender (BR)', col: 'gender_br', read: (v) => (v ?? '').trim() || null },
  { csv: 'Gender (ES)', col: 'gender_es', read: (v) => (v ?? '').trim() || null },
  { csv: 'Logo Image (WEBP)', col: 'logo_url', read: (v) => (v ?? '').trim() || null },
];

export type CsvImportResult = { updated: number; skipped: number; skippedIds: string[] };

export async function importTeamsFromCsv(text: string): Promise<CsvImportResult> {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
  if (!records.length) return { updated: 0, skipped: 0, skippedIds: [] };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Mapa de ID (api_football ou espn) -> time existente.
  const { data: teams, error: te } = await supabase
    .from('teams')
    .select('id, api_football_id, espn_id, overrides');
  if (te) throw new Error(`teams: ${te.message}`);
  const byId = new Map<string, { id: string; overrides: unknown }>();
  for (const t of teams ?? []) {
    if (t.api_football_id) byId.set(String(t.api_football_id), t);
    if (t.espn_id) byId.set(String(t.espn_id), t);
  }

  let updated = 0;
  const skippedIds: string[] = [];
  for (const r of records) {
    const id = String(r['ID'] ?? '').trim();
    const team = id ? byId.get(id) : undefined;
    if (!team) {
      if (id) skippedIds.push(id);
      continue;
    }

    const ov = new Set(Array.isArray(team.overrides) ? (team.overrides as string[]) : []);
    const upd: Record<string, unknown> = { updated_at: now };
    for (const m of MAPPINGS) {
      if (!(m.csv in r)) continue; // coluna ausente no arquivo
      const val = m.read(r[m.csv]);
      if (val === null || val === '') continue; // célula vazia: não sobrescreve
      upd[m.col] = val;
      ov.add(m.col); // editado via planilha -> prioridade manual
    }
    if (Object.keys(upd).length === 1) continue; // nada além de updated_at

    upd.overrides = [...ov];
    const { error } = await supabase.from('teams').update(upd).eq('id', team.id);
    if (error) throw new Error(`update ${id}: ${error.message}`);
    updated++;
  }

  return { updated, skipped: skippedIds.length, skippedIds };
}
