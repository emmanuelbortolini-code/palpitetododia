import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildLeagueModel, buildWeightedLeagueModel, matchProbabilities, type LeagueModel, type Game } from '@/lib/probability';
import { computeElo, eloMatchProbabilities } from '@/lib/elo';
import { loadIntlHistory } from '@/lib/intl-history';

export const dynamic = 'force-dynamic';

const CURRENT_SEASON = new Date().getFullYear();
const UPCOMING = ['scheduled', 'live', 'postponed'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function ProbabilidadesPage({
  searchParams,
}: {
  searchParams: { liga?: string };
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  // Modelo por liga a partir do team_season_stats (só ligas com tabela: points != null).
  const { data: tss } = await supabase
    .from('team_season_stats')
    .select('league_id, team_id, points, home_played, home_gf, home_ga, away_played, away_gf, away_ga, raw')
    .eq('season', CURRENT_SEASON);

  const rowsByLeague = new Map<string, Record<string, unknown>[]>();
  for (const r of tss ?? []) {
    const lid = r.league_id as string;
    (rowsByLeague.get(lid) ?? rowsByLeague.set(lid, []).get(lid)!).push(r);
  }

  const RESULT_PT: Record<string, string> = { W: 'V', D: 'E', L: 'D' };
  const models = new Map<string, LeagueModel>();
  const formByTeam = new Map<string, string>();
  for (const [lid, rows] of rowsByLeague) {
    if (!rows.some((r) => r.points != null)) continue; // pula copas (sem tabela)
    // Modelo ponderado por recência a partir do schedule; cai p/ o agregado se faltar.
    const teams = rows.map((r) => ({
      teamId: r.team_id as string,
      games: ((r.raw as { schedule?: Game[] } | null)?.schedule ?? []).filter(
        (g) => typeof g.gf === 'number' && typeof g.ga === 'number',
      ),
    }));
    const m = buildWeightedLeagueModel(teams) ?? buildLeagueModel(rows as never);
    if (m) models.set(lid, m);
    // Forma: últimos 5 resultados (mais recente à esquerda).
    for (const r of rows) {
      const sch = ((r.raw as { schedule?: { date: string; result: string }[] } | null)?.schedule ?? []);
      const last5 = [...sch]
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        .slice(0, 5)
        .map((g) => RESULT_PT[g.result] ?? '?')
        .join('');
      if (last5) formByTeam.set(r.team_id as string, last5);
    }
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

  // Uma aba por liga (os jogos já vêm ordenados por data dentro de cada liga).
  const byLeague = new Map<string, { name: string; items: typeof games }>();
  for (const g of games) {
    const lid = g.m.league_id as string;
    const name = (g.m.league as unknown as { name: string } | null)?.name ?? '—';
    if (!byLeague.has(lid)) byLeague.set(lid, { name, items: [] });
    byLeague.get(lid)!.items.push(g);
  }
  // Copa do Mundo entra como mais uma aba, com modelo próprio (Elo de seleções).
  const { data: wcLeague } = await supabase
    .from('leagues')
    .select('id, name')
    .eq('slug', 'copa-do-mundo-fifa')
    .maybeSingle();
  const { data: wcMatches } = wcLeague
    ? await supabase
        .from('matches')
        .select('id, scheduled_at, league_id, home_team_id, away_team_id, home:home_team_id(name, espn_id), away:away_team_id(name, espn_id), league:league_id(name)')
        .eq('league_id', wcLeague.id)
        .in('status', UPCOMING)
        .order('scheduled_at', { ascending: true })
        .limit(120)
    : { data: [] };
  const hasWc = !!wcLeague && (wcMatches ?? []).length > 0;

  const leagues = [
    ...[...byLeague.entries()].map(([id, v]) => ({ id, name: v.name })),
    ...(hasWc ? [{ id: wcLeague!.id as string, name: wcLeague!.name as string }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const selected = leagues.some((l) => l.id === searchParams.liga) ? searchParams.liga! : leagues[0]?.id;

  // O Elo (histórico internacional) só é computado quando a aba da Copa está selecionada.
  const isWc = hasWc && selected === wcLeague!.id;
  const eloByTeam = new Map<string, number>();
  let shown: typeof games = [];
  if (isWc) {
    const intl = await loadIntlHistory(supabase);
    const elo = computeElo(intl);
    const ratingOf = (espnId: string | null | undefined) => (espnId ? elo.get(String(espnId))?.rating ?? 1500 : 1500);
    shown = (wcMatches ?? []).map((m) => {
      const home = m.home as unknown as { espn_id: string | null } | null;
      const away = m.away as unknown as { espn_id: string | null } | null;
      const rh = ratingOf(home?.espn_id);
      const ra = ratingOf(away?.espn_id);
      eloByTeam.set(m.home_team_id as string, rh);
      eloByTeam.set(m.away_team_id as string, ra);
      return { m, probs: eloMatchProbabilities(rh, ra) };
    }) as unknown as typeof games;
  } else if (selected) {
    shown = byLeague.get(selected)?.items ?? [];
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Probabilidades</h1>
        <a href="/admin/probabilidades/calibracao" className="text-sm text-blue-600 hover:underline">
          Calibração →
        </a>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        {isWc
          ? 'Copa do Mundo: Elo internacional das seleções convertido em gols esperados (Poisson + Dixon-Coles), sede neutra. O número ao lado de cada seleção é o Elo.'
          : `Poisson + Dixon-Coles por mando, com ponderação por recência (jogos recentes pesam mais) na temporada ${CURRENT_SEASON}. Próximos jogos das ligas com tabela; forma = últimos 5 (mais recente à esquerda).`}
      </p>

      {!leagues.length ? (
        <p className="text-sm text-gray-500">
          Sem jogos para estimar. Confira se há jogos agendados e se o team_season_stats está sincronizado.
        </p>
      ) : (
        <>
        {leagues.length >= 1 && (
          <div className="mb-4 flex flex-wrap gap-1 border-b">
            {leagues.map((l) => (
              <a
                key={l.id}
                href={`/admin/probabilidades?liga=${l.id}`}
                className={`border-b-2 px-3 py-1.5 text-sm ${
                  l.id === selected ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                {l.name}
              </a>
            ))}
          </div>
        )}
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
            {shown.map(({ m, probs }) => {
              const p = probs!;
              const home = (m.home as unknown as { name: string } | null)?.name ?? '—';
              const away = (m.away as unknown as { name: string } | null)?.name ?? '—';
              const date = m.scheduled_at ? new Date(m.scheduled_at as string).toLocaleDateString('pt-BR') : '—';
              return (
                <tr key={m.id as string} className="border-t">
                  <td className="py-1.5 pr-2 text-gray-500">{date}</td>
                  <td className="py-1.5 pr-2">
                    {home}
                    {formByTeam.has(m.home_team_id as string) && (
                      <span className="ml-1 font-mono text-xs text-gray-400">{formByTeam.get(m.home_team_id as string)}</span>
                    )}
                    {eloByTeam.has(m.home_team_id as string) && (
                      <span className="ml-1 font-mono text-xs text-gray-400">{eloByTeam.get(m.home_team_id as string)!.toFixed(0)}</span>
                    )}
                    <span className="text-gray-400"> x </span>
                    {away}
                    {formByTeam.has(m.away_team_id as string) && (
                      <span className="ml-1 font-mono text-xs text-gray-400">{formByTeam.get(m.away_team_id as string)}</span>
                    )}
                    {eloByTeam.has(m.away_team_id as string) && (
                      <span className="ml-1 font-mono text-xs text-gray-400">{eloByTeam.get(m.away_team_id as string)!.toFixed(0)}</span>
                    )}
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
        </>
      )}
    </main>
  );
}
