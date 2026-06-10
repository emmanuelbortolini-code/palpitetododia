import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  walkForwardBacktest,
  evaluate,
  type TeamSchedule,
  type FinishedMatch,
  type ScoredPred,
  type CalibrationReport,
  type ReliabilityBin,
} from '@/lib/calibration';
import type { Game } from '@/lib/probability';

export const dynamic = 'force-dynamic';

const CURRENT_SEASON = new Date().getFullYear();
const f3 = (x: number) => x.toFixed(3);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function CalibracaoPage() {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  // --- Insumos do backtest: schedules por liga (com tabela) + jogos encerrados ---
  const { data: tss } = await supabase
    .from('team_season_stats')
    .select('league_id, team_id, points, raw')
    .eq('season', CURRENT_SEASON);

  const rowsByLeague = new Map<string, { team_id: string; points: number | null; raw: unknown }[]>();
  for (const r of tss ?? []) {
    const lid = r.league_id as string;
    (rowsByLeague.get(lid) ?? rowsByLeague.set(lid, []).get(lid)!).push(r as never);
  }

  const schedulesByLeague = new Map<string, TeamSchedule[]>();
  for (const [lid, rows] of rowsByLeague) {
    if (!rows.some((r) => r.points != null)) continue; // só ligas com tabela
    schedulesByLeague.set(
      lid,
      rows.map((r) => ({
        teamId: r.team_id,
        games: ((r.raw as { schedule?: Game[] } | null)?.schedule ?? []).filter(
          (g) => typeof g.gf === 'number' && typeof g.ga === 'number',
        ),
      })),
    );
  }
  const leagueIds = [...schedulesByLeague.keys()];

  const { data: finished } = leagueIds.length
    ? await supabase
        .from('matches')
        .select('league_id, home_team_id, away_team_id, scheduled_at, home_score, away_score')
        .in('league_id', leagueIds)
        .eq('status', 'finished')
    : { data: [] };

  const matches: FinishedMatch[] = (finished ?? [])
    .filter((m) => m.scheduled_at && m.home_score != null && m.away_score != null)
    .map((m) => ({
      leagueId: m.league_id as string,
      homeTeamId: m.home_team_id as string,
      awayTeamId: m.away_team_id as string,
      date: m.scheduled_at as string,
      homeScore: m.home_score as number,
      awayScore: m.away_score as number,
    }));

  const { scored: backtestScored, skipped } = walkForwardBacktest(schedulesByLeague, matches);
  const backtest = backtestScored.length ? evaluate(backtestScored) : null;

  // --- Previsões persistidas já pontuadas ---
  const { data: persisted } = await supabase
    .from('match_predictions')
    .select('p_home, p_draw, p_away, p_over25, p_btts, actual_home_score, actual_away_score')
    .not('scored_at', 'is', null);

  const persistedScored: ScoredPred[] = (persisted ?? []).map((p) => {
    const h = p.actual_home_score as number;
    const a = p.actual_away_score as number;
    return {
      pHome: Number(p.p_home),
      pDraw: Number(p.p_draw),
      pAway: Number(p.p_away),
      pOver: Number(p.p_over25),
      pBtts: Number(p.p_btts),
      outcome: h > a ? 'H' : h < a ? 'A' : 'D',
      over: h + a >= 3 ? 1 : 0,
      btts: h >= 1 && a >= 1 ? 1 : 0,
    };
  });
  const persistedReport = persistedScored.length ? evaluate(persistedScored) : null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Calibração</h1>
        <Link href="/admin/probabilidades" className="text-sm text-blue-600 hover:underline">
          ← Probabilidades
        </Link>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Quão boas são as previsões. Brier e log-loss: menor é melhor. O Brier é comparado a um{' '}
        <em>baseline</em> (palpite constante = taxa-base da liga); ficar abaixo dele indica habilidade. A tabela de
        confiabilidade mostra, por faixa de probabilidade prevista, a frequência realmente observada (ideal: prevista ≈
        observada).
      </p>

      <Section
        title="Backtest walk-forward"
        subtitle={`Reconstrói o modelo só com jogos anteriores a cada partida encerrada da temporada ${CURRENT_SEASON} (sem vazamento). ${
          backtest ? `${backtest.n} jogos avaliados, ${skipped} pulados (amostra insuficiente).` : ''
        }`}
        report={backtest}
        empty="Sem jogos encerrados suficientes para o backtest. Sincronize estatísticas de temporada."
      />

      <Section
        title="Previsões persistidas (pré-jogo)"
        subtitle={
          persistedReport
            ? `Previsões travadas antes do jogo vs resultado real, acumuladas ao longo do tempo (${persistedReport.n} jogos pontuados).`
            : 'Previsões gravadas antes do jogo e pontuadas quando encerram. Acumula com o tempo — rode “Gerar/Pontuar Previsões” em Jogos.'
        }
        report={persistedReport}
        empty="Nenhuma previsão pontuada ainda. Gere previsões dos próximos jogos e volte após eles encerrarem."
      />
    </main>
  );
}

function Section({
  title,
  subtitle,
  report,
  empty,
}: {
  title: string;
  subtitle: string;
  report: CalibrationReport | null;
  empty: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-gray-500">{subtitle}</p>
      {!report ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <>
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-2">Mercado</th>
                <th className="py-1 pr-2 text-center">Brier</th>
                <th className="py-1 pr-2 text-center">Baseline</th>
                <th className="py-1 pr-2 text-center">Log-loss</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="1X2" brier={report.brier.x2} base={report.baseline.x2} loss={report.logLoss.x2} />
              <MetricRow label="Over 2.5" brier={report.brier.over} base={report.baseline.over} loss={report.logLoss.over} />
              <MetricRow label="BTTS" brier={report.brier.btts} base={report.baseline.btts} loss={report.logLoss.btts} />
            </tbody>
          </table>
          <div className="grid gap-4 sm:grid-cols-3">
            <Reliability title="1X2 (um-contra-resto)" bins={report.reliability.x2} />
            <Reliability title="Over 2.5" bins={report.reliability.over} />
            <Reliability title="BTTS" bins={report.reliability.btts} />
          </div>
        </>
      )}
    </section>
  );
}

function MetricRow({ label, brier, base, loss }: { label: string; brier: number; base: number; loss: number }) {
  const better = brier < base;
  return (
    <tr className="border-t">
      <td className="py-1.5 pr-2">{label}</td>
      <td className={`py-1.5 pr-2 text-center font-medium ${better ? 'text-green-700' : 'text-red-600'}`}>{f3(brier)}</td>
      <td className="py-1.5 pr-2 text-center text-gray-500">{f3(base)}</td>
      <td className="py-1.5 pr-2 text-center text-gray-600 dark:text-gray-300">{f3(loss)}</td>
    </tr>
  );
}

function Reliability({ title, bins }: { title: string; bins: ReliabilityBin[] }) {
  const rows = bins.filter((b) => b.n > 0);
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-400">
            <th className="py-0.5 pr-1">Faixa</th>
            <th className="py-0.5 pr-1 text-center">N</th>
            <th className="py-0.5 pr-1 text-center">Prev.</th>
            <th className="py-0.5 text-center">Obs.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.lo} className="border-t">
              <td className="py-0.5 pr-1 tabular-nums text-gray-500">
                {pct(b.lo)}–{pct(b.hi)}
              </td>
              <td className="py-0.5 pr-1 text-center tabular-nums">{b.n}</td>
              <td className="py-0.5 pr-1 text-center tabular-nums">{pct(b.predMean)}</td>
              <td className="py-0.5 text-center tabular-nums font-medium">{pct(b.obsRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
