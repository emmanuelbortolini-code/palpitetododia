'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAllTeams } from '@/lib/sync/teams';

export type ActionState = { error?: string; message?: string };

export async function syncAllTeamsAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncAllTeams();
    revalidatePath('/admin/equipes');
    return {
      message: `${r.teams} times sincronizados (${r.links} vínculos, ${r.requests} requisições).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar times.' };
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
      country_id: countryId,
      founded: optInt(formData.get('founded')),
      venue_name: optText(formData.get('venue_name')),
      venue_address: optText(formData.get('venue_address')),
      venue_city: optText(formData.get('venue_city')),
      venue_capacity: optInt(formData.get('venue_capacity')),
      website: optText(formData.get('website')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/equipes');
  redirect('/admin/equipes');
}
