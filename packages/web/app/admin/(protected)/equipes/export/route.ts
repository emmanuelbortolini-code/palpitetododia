import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Cabeçalho no mesmo formato do CSV de referência (#dados/brazil-serie-a-2026-teams.csv).
const HEADER = [
  'ID',
  'Name (EN)',
  'Name (BR)',
  'Name (ES)',
  'Slug (EN)',
  'Slug (BR)',
  'Slug (ES)',
  'Country',
  'Founded Year',
  'Stadium Name',
  'Stadium Address',
  'Official Sites',
  'Nicknames (EN)',
  'Nicknames (BR)',
  'Nicknames (ES)',
  'Gender (EN)',
  'Gender (BR)',
  'Gender (ES)',
  'Logo Image (WEBP)',
];

function cell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Apelidos voltam ao formato do modelo: array JSON de {value, gender} (round-trip
// no import). Aceita a forma canônica [{value, gender}] e o legado [string].
type Nick = string | { value?: string; gender?: string | null };
function nicks(v: Nick[] | null): string {
  if (!v?.length) return '';
  const arr = v
    .map((x) => (typeof x === 'string' ? { value: x } : x))
    .filter((x): x is { value: string; gender?: string | null } => !!x.value)
    .map((x) => (x.gender ? { value: x.value, gender: x.gender } : { value: x.value }));
  return arr.length ? JSON.stringify(arr) : '';
}

export async function GET() {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const { data: teams, error } = await supabase
    .from('teams')
    .select(
      'api_football_id, espn_id, name, name_en, name_es, slug, slug_en, slug_es, founded, venue_name, venue_address, website, nicknames_en, nicknames_pt, nicknames_es, gender_en, gender_br, gender_es, logo_url, country:country_id(name)',
    )
    .is('merged_into', null)
    .order('name', { ascending: true });
  if (error) return new Response(error.message, { status: 500 });

  const lines = [HEADER.map(cell).join(',')];
  for (const t of teams ?? []) {
    const country = (t.country as unknown as { name: string } | null)?.name ?? '';
    lines.push(
      [
        t.api_football_id ?? t.espn_id,
        t.name_en,
        t.name,
        t.name_es,
        t.slug_en,
        t.slug,
        t.slug_es,
        country,
        t.founded,
        t.venue_name,
        t.venue_address,
        t.website,
        nicks(t.nicknames_en as Nick[] | null),
        nicks(t.nicknames_pt as Nick[] | null),
        nicks(t.nicknames_es as Nick[] | null),
        t.gender_en,
        t.gender_br,
        t.gender_es,
        t.logo_url,
      ]
        .map(cell)
        .join(','),
    );
  }

  // BOM para o Excel ler acentos corretamente.
  const csv = '﻿' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="equipes.csv"',
    },
  });
}
