import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildLeagueModel, matchProbabilities, type LeagueModel } from '@/lib/probability';

export const dynamic = 'force-dynamic';

const CURRENT_SEASON = new Date().getFullYear();
const UPCOMING = ['scheduled', 'live', 'postponed'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function ProbabilidadesPage() {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  // Modelo por liga a partir do team_season_stats (só ligas com tabela: points != null).
  const { data: tss } = await supabase
    .from('team_season_stats')
    .select('league_id, team_id, points, home_played, home_gf, home_ga, away_played, away_gf, away_ga')
    .eq('season', CURRENT_SEASON);

  const rowsByLeague = new Map<string, Record<string, unknown>[]>();
  for (const r of tss ?? []) {
    const lid = r.league_id as string;
    (rowsByLeague.get(lid) ?? rowsByLeague.set(lid, []).get(lid)!).push(r);
  }
  const models = new Map<string, LeagueModel>();
  for (const [lid, rows] of rowsByLeague) {
    if (!rows.some((r) => r.points != null)) continue; // pula copas (sem tabela)
    const m = buildLeagueModel(rows as never);
    if (m) models.set(lid, m);
  }
  const leagueIds = [...models.keys()];

  const { data: matches } = leagueIds.length
    ? await supabase
        .from('matches')
        .select('id, scheduled_at, league_id, home_team_id, away_team_id, home:home_team_id(name), away:away_team_id(name), league:league_id(name)')
        .in('league_id', leagueIds)
        .in('status', UPCOMING)
        .order('scheduled_at', { ascending: true })
        .limit(80)
    : { data: [] };

  const games = (matches ?? [])
    .map((m) => {
      const model = models.get(m.league_id as string)!;
      const probs = matchProbabilities(model, m.home_team_id as string, m.away_team_id as string);
      return { m, probs };
    })
    .filter((g) => g.probs);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Probabilidades</h1>
      <p className="mb-4 text-sm text-gray-500">
        Modelo de Poisson por mando (força de ataque/defesa casa/fora da temporada {CURRENT_SEASON}). Próximos jogos das
        ligas com tabela.
      </p>

      {!games.length ? (
        <p className="text-sm text-gray-500">
          Sem jogos para estimar. Confira se há jogos agendados e se o team_season_stats está sincronizado.
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
            {games.map(({ m, probs }) => {
              const p = probs!;
              const home = (m.home as unknown as { name: string } | null)?.name ?? '—';
              const away = (m.away as unknown as { name: string } | null)?.name ?? '—';
              const date = m.scheduled_at ? new Date(m.scheduled_at as string).toLocaleDateString('pt-BR') : '—';
              return (
                <tr key={m.id as string} className="border-t">
                  <td className="py-1.5 pr-2 text-gray-500">{date}</td>
                  <td className="py-1.5 pr-2">
                    {home} <span className="text-gray-400">x</span> {away}
                  </td>
                  <td className="py-1.5 text-center font-medium">{pct(p.homeWin)}</td>
                  <td className="py-1.5 text-center text-gray-600 dark:text-gray-300">{pct(p.draw)}</td>
                  <td className="py-1.5 text-center font-medium">{pct(p.awayWin)}</td>
                  <td className="py-1.5 text-center">{pct(p.over25)}</td>
                  <td className="py-1.5 text-center">{pct(p.btts)}</td>
                  <td className="py-1.5 text-center tabular-nums text-gray-500">
                    {p.topScore.home}–{p.topScore.away}
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
