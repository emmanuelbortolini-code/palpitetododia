'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { syncMatches } from '@/lib/sync/matches';

export type ActionState = { error?: string; message?: string };

/** Dispara o sync manualmente a partir do /admin/jogos. Somente admin. */
export async function syncNow(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin') return { error: 'Apenas administradores podem sincronizar.' };

  try {
    const r = await syncMatches();
    revalidatePath('/admin/jogos');
    if (!r.league) {
      return { message: `Nenhuma partida retornada para a temporada ${r.season}.` };
    }
    return {
      message: `${r.league} ${r.season}: ${r.teams} times, ${r.matches} partidas sincronizadas.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar.' };
  }
}
