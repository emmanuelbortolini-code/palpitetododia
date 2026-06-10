import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeElo, eloMatchProbabilities, type IntlGame } from '@/lib/elo';

export const dynamic = 'force-dynamic';

const UPCOMING = ['scheduled', 'live', 'postponed'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Carrega TODOS os jogos internacionais (paginado; o PostgREST limita ~1000/consulta). */
async function loadHistory(supabase: ReturnType<typeof createAdminClient>): Promise<IntlGame[]> {
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

export default async function CopaPage() {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const { data: league } = await supabase.from('leagues').select('id').eq('slug', 'copa-do-mundo-fifa').maybeSingle();
  const games = await loadHistory(supabase);
  const elo = computeElo(games);

  const { data: matches } = league
    ? await supabase
        .from('matches')
        .select('id, scheduled_at, home_team_id, away_team_id, home:home_team_id(name, espn_id), away:away_team_id(name, espn_id)')
        .eq('league_id', league.id)
        .in('status', UPCOMING)
        .order('scheduled_at', { ascending: true })
        .limit(120)
    : { data: [] };

  const ratingOf = (espnId: string | null | undefined) => (espnId ? elo.get(String(espnId))?.rating ?? 1500 : 1500);

  const rows = (matches ?? []).map((m) => {
    const home = m.home as unknown as { name: string; espn_id: string | null } | null;
    const away = m.away as unknown as { name: string; espn_id: string | null } | null;
    const rh = ratingOf(home?.espn_id);
    const ra = ratingOf(away?.espn_id);
    return { m, home, away, rh, ra, probs: eloMatchProbabilities(rh, ra) };
  });

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Copa do Mundo — Probabilidades</h1>
        <Link href="/admin/probabilidades" className="text-sm text-blue-600 hover:underline">
          ← Probabilidades
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Modelo de seleções: Elo internacional ({games.length} jogos de amistosos, eliminatórias, Nations League e
        torneios continentais desde 2021) convertido em gols esperados e na matriz Poisson + Dixon-Coles. Sede neutra
        (sem mando). O Elo (entre parênteses) atualiza conforme a Copa avança.
      </p>

      {!rows.length ? (
        <p className="text-sm text-gray-500">
          Sem jogos para estimar. Confira se os jogos da Copa estão sincronizados e o histórico internacional importado
          (migration 021 + scripts/sync-wc-history.cjs).
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-2">Data</th>
              <th className="py-1 pr-2">Jogo</th>
              <th className="py-1 text-center">1</th>
              <th className="py-1 text-center">X</th>
              <th className="py-1 text-center">2</th>
              <th className="py-1 text-center">+2.5</th>
              <th className="py-1 text-center">BTTS</th>
              <th className="py-1 text-center">Placar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, home, away, rh, ra, probs }) => {
              const date = m.scheduled_at ? new Date(m.scheduled_at as string).toLocaleDateString('pt-BR') : '—';
              return (
                <tr key={m.id as string} className="border-t">
                  <td className="py-1.5 pr-2 text-gray-500">{date}</td>
                  <td className="py-1.5 pr-2">
                    {home?.name ?? '—'} <span className="font-mono text-xs text-gray-400">{rh.toFixed(0)}</span>
                    <span className="text-gray-400"> x </span>
                    {away?.name ?? '—'} <span className="font-mono text-xs text-gray-400">{ra.toFixed(0)}</span>
                  </td>
                  <td className="py-1.5 text-center font-medium">{pct(probs.homeWin)}</td>
                  <td className="py-1.5 text-center text-gray-600 dark:text-gray-300">{pct(probs.draw)}</td>
                  <td className="py-1.5 text-center font-medium">{pct(probs.awayWin)}</td>
                  <td className="py-1.5 text-center">{pct(probs.over25)}</td>
                  <td className="py-1.5 text-center">{pct(probs.btts)}</td>
                  <td className="py-1.5 text-center tabular-nums text-gray-500">
                    {probs.topScore.home}–{probs.topScore.away}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
