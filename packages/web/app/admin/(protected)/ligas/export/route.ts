import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Cabeçalho no formato do CSV de referência (#dados/brazil-serie-d-league-data.csv).
const HEADER = [
  'ID',
  'Name (EN)', 'Name (BR)', 'Name (ES)',
  'Country Name (EN)', 'Country Name (BR)', 'Country Name (ES)',
  'Slug (EN)', 'Slug (BR)', 'Slug (ES)',
  'Country Slug (EN)', 'Country Slug (BR)', 'Country Slug (ES)',
  'Nicknames (EN)', 'Nicknames (BR)', 'Nicknames (ES)',
  'Gender (EN)', 'Gender (BR)', 'Gender (ES)',
  'Logo (WEBP)', 'Country Flag (WEBP)',
];

function cell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function nicks(v: string[] | null): string {
  if (!v?.length) return '';
  return JSON.stringify(v.map((value) => ({ value })));
}

export async function GET() {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select(
      'external_api_id, name, name_en, name_es, slug, slug_en, slug_es, nicknames_en, nicknames_pt, nicknames_es, gender_en, gender_br, gender_es, logo_url, country:country_id(name)',
    )
    .is('merged_into', null)
    .order('name', { ascending: true });
  if (error) return new Response(error.message, { status: 500 });

  const lines = [HEADER.map(cell).join(',')];
  for (const l of leagues ?? []) {
    const country = (l.country as unknown as { name: string } | null)?.name ?? '';
    lines.push(
      [
        l.external_api_id,
        l.name_en, l.name, l.name_es,
        '', country, '',
        l.slug_en, l.slug, l.slug_es,
        '', '', '',
        nicks(l.nicknames_en as string[] | null), nicks(l.nicknames_pt as string[] | null), nicks(l.nicknames_es as string[] | null),
        l.gender_en, l.gender_br, l.gender_es,
        l.logo_url, '',
      ]
        .map(cell)
        .join(','),
    );
  }

  const csv = '﻿' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ligas.csv"',
    },
  });
}
