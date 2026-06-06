import { createClient } from '@/lib/supabase/server';

export type MatchOption = { id: string; label: string };

/** Partidas para o seletor do formulário de palpites (mais recentes primeiro). */
export async function getMatchOptions(): Promise<MatchOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('matches')
    .select('id, scheduled_at, home:home_team_id(name), away:away_team_id(name)')
    .order('scheduled_at', { ascending: false })
    .limit(100);

  return (data ?? []).map((m) => {
    const home = m.home as unknown as { name: string } | null;
    const away = m.away as unknown as { name: string } | null;
    const d = new Date(m.scheduled_at).toLocaleDateString('pt-BR');
    return { id: m.id, label: `${home?.name} x ${away?.name} — ${d}` };
  });
}
