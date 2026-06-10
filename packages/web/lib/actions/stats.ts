'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { syncMatchStats } from '@/lib/sync/stats';
import { syncTeamSeasonStats } from '@/lib/sync/team-stats';
import { syncPlayerSeasonStats } from '@/lib/sync/player-stats';

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

/** Sincroniza os agregados de temporada dos times (ESPN) para team_season_stats. */
export async function syncTeamSeasonStatsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncTeamSeasonStats();
    revalidatePath('/admin/jogos');
    return {
      message: `${r.updated} times com estatísticas de temporada salvas${r.skipped ? `, ${r.skipped} sem dados na ESPN` : ''} (de ${r.processed} processados).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar estatísticas de temporada.' };
  }
}

/** Sincroniza os artilheiros/líderes por jogador (ESPN) para player_season_stats. */
export async function syncPlayerSeasonStatsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncPlayerSeasonStats();
    revalidatePath('/admin/jogos');
    return { message: `${r.updated} jogadores salvos em ${r.leagues} competição(ões).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar artilheiros.' };
  }
}
