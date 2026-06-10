import type { createAdminClient } from '@/lib/supabase/admin';
import type { IntlGame } from '@/lib/elo';

/** Carrega TODOS os jogos internacionais (paginado; o PostgREST limita ~1000/consulta). */
export async function loadIntlHistory(supabase: ReturnType<typeof createAdminClient>): Promise<IntlGame[]> {
  const games: IntlGame[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('international_matches')
      .select('played_at, home_espn_id, away_espn_id, home_goals, away_goals, neutral, importance')
      .order('played_at', { ascending: true })
      .range(from, from + 999);
    if (!data?.length) break;
    for (const g of data)
      games.push({
        date: g.played_at as string,
        home: String(g.home_espn_id),
        away: String(g.away_espn_id),
        hg: g.home_goals as number,
        ag: g.away_goals as number,
        neutral: !!g.neutral,
        importance: g.importance as number,
      });
    if (data.length < 1000) break;
  }
  return games;
}
