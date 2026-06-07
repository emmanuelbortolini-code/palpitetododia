'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBrazilLeagues } from '@/lib/sync/refdata';

export type ActionState = { error?: string; message?: string };

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
