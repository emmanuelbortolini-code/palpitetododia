'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { syncMatchStats } from '@/lib/sync/stats';

export type ActionState = { error?: string; message?: string };

/** Sincroniza as estatísticas dos jogos encerrados (ESPN) para match_stats. */
export async function syncMatchStatsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncMatchStats();
    revalidatePath('/admin/jogos');
    return {
      message: `${r.updated} jogos com estatísticas salvas${r.skipped ? `, ${r.skipped} sem stats na ESPN` : ''} (de ${r.processed} pendentes).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar estatísticas.' };
  }
}
