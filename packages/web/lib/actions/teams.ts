'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { importTeamsFromCsv } from '@/lib/sync/csv-teams';

export type ActionState = { error?: string; message?: string };

export async function importTeamsCsvAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Selecione um arquivo CSV.' };
  }
  const leagueName = String(formData.get('league_name') ?? '').trim();
  const season = Number(formData.get('season')) || undefined;

  try {
    const text = await file.text();
    const r = await importTeamsFromCsv(text, {
      leagueName: leagueName || undefined,
      season,
    });
    revalidatePath('/admin/equipes');
    return {
      message: `${r.teams} equipes importadas${r.links ? ` (${r.links} vínculos)` : ''}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao importar CSV.' };
  }
}

function optInt(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function optText(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

// "Apelido 1, Apelido 2" → ["Apelido 1", "Apelido 2"] (ou null).
function optList(v: FormDataEntryValue | null): string[] | null {
  const items = String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export async function updateTeam(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Nome é obrigatório.' };
  const countryId = String(formData.get('country_id') ?? '').trim();
  if (!countryId) return { error: 'Selecione o país.' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('teams')
    .update({
      name,
      name_en: optText(formData.get('name_en')),
      name_es: optText(formData.get('name_es')),
      country_id: countryId,
      founded: optInt(formData.get('founded')),
      venue_name: optText(formData.get('venue_name')),
      venue_address: optText(formData.get('venue_address')),
      venue_city: optText(formData.get('venue_city')),
      venue_capacity: optInt(formData.get('venue_capacity')),
      website: optText(formData.get('website')),
      gender: optText(formData.get('gender')),
      nicknames_pt: optList(formData.get('nicknames_pt')),
      nicknames_en: optList(formData.get('nicknames_en')),
      nicknames_es: optList(formData.get('nicknames_es')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/equipes');
  redirect('/admin/equipes');
}
