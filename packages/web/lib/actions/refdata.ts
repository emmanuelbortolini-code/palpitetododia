'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { syncBrazilLeagues, syncTeamsForLeague } from '@/lib/sync/refdata';

export type ActionState = { error?: string; message?: string };

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

export async function syncTeamsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);
  const leagueId = String(formData.get('league_id') ?? '');
  const season = Number(formData.get('season') ?? 0);
  if (!leagueId) return { error: 'Selecione uma liga.' };
  if (!season) return { error: 'Informe a temporada.' };

  try {
    const r = await syncTeamsForLeague(leagueId, season);
    revalidatePath('/admin/equipes');
    return {
      message: `${r.league}: ${r.count} times sincronizados (temporada ${r.season}).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar times.' };
  }
}
