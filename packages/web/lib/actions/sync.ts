'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { syncEspnFixtures } from '@/lib/sync/fixtures';

export type ActionState = { error?: string; message?: string };

/** Dispara o sync de jogos (ESPN, temporada atual) a partir do /admin/jogos. */
export async function syncNow(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);

  try {
    const r = await syncEspnFixtures();
    revalidatePath('/admin/jogos');
    return {
      message: `${r.matches} jogos sincronizados de ${r.leagues} ligas da ESPN${r.skipped ? ` (${r.skipped} pulados — time não cadastrado)` : ''}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar.' };
  }
}
