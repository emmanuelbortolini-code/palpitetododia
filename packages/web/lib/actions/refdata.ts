'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBrazilLeagues } from '@/lib/sync/refdata';

export type ActionState = { error?: string; message?: string };

function optText(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}
function optList(v: FormDataEntryValue | null): string[] | null {
  const items = String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return items.length ? items : null;
}

export async function updateLeague(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Nome é obrigatório.' };
  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) return { error: 'Slug é obrigatório.' };
  const countryId = String(formData.get('country_id') ?? '').trim();
  if (!countryId) return { error: 'Selecione o país.' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('leagues')
    .update({
      name,
      name_en: optText(formData.get('name_en')),
      name_es: optText(formData.get('name_es')),
      slug,
      slug_en: optText(formData.get('slug_en')),
      slug_es: optText(formData.get('slug_es')),
      country_id: countryId,
      logo_url: optText(formData.get('logo_url')),
      nicknames_pt: optList(formData.get('nicknames_pt')),
      nicknames_en: optList(formData.get('nicknames_en')),
      nicknames_es: optList(formData.get('nicknames_es')),
      gender_en: optText(formData.get('gender_en')),
      gender_br: optText(formData.get('gender_br')),
      gender_es: optText(formData.get('gender_es')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/ligas');
  redirect('/admin/ligas');
}

// Liga/descura uma liga (controla o que aparece nos filtros de Equipes e na lista).
export async function setLeagueCurated(id: string, curated: boolean) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();
  await supabase.from('leagues').update({ curated }).eq('id', id);
  revalidatePath('/admin/ligas');
  revalidatePath('/admin/equipes');
}

export async function syncLeaguesAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncBrazilLeagues();
    revalidatePath('/admin/ligas');
    revalidatePath('/admin/equipes');
    return { message: `${r.count} ligas do Brasil sincronizadas.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar ligas.' };
  }
}
