import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/staff';
import { SyncButton } from '@/components/admin/sync-button';
import { MatchStatsButton } from '@/components/admin/match-stats-button';
import { TeamStatsButton } from '@/components/admin/team-stats-button';

export const dynamic = 'force-dynamic';

const SIZES = [20, 50, 100];
const FINISHED = ['finished', 'cancelled'];
const UPCOMING = ['scheduled', 'live', 'postponed'];

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada', live: 'Ao vivo', finished: 'Encerrada', postponed: 'Adiada', cancelled: 'Cancelada',
};

type SearchParams = { tab?: string; q?: string; league?: string; page?: string; size?: string };

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const tab = searchParams.tab === 'encerrados' ? 'encerrados' : 'proximos';
  const fQ = (searchParams.q ?? '').trim();
  const fLeague = searchParams.league ?? '';
  const size = SIZES.includes(Number(searchParams.size)) ? Number(searchParams.size) : 50;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const statuses = tab === 'encerrados' ? FINISHED : UPCOMING;
  const asc = tab === 'proximos';

  // Ligas ativas (opções do filtro + escopo padrão).
  const { data: cur } = await supabase.from('leagues').select('id, name').eq('curated', true).order('name');
  const curatedIds = (cur ?? []).map((l) => l.id);
  const leagueIds = fLeague && curatedIds.includes(fLeague) ? [fLeague] : curatedIds;

  // Busca por time (mandante OU visitante): resolve ids por nome.
  let teamIds: string[] | null = null;
  if (fQ) {
    const { data: ts } = await supabase.from('teams').select('id').ilike('name', `%${fQ}%`).limit(300);
    teamIds = (ts ?? []).map((t) => t.id);
  }

  const buildQuery = () => {
    let q = supabase
      .from('matches')
      .select('id, scheduled_at, status, home_score, away_score, home:home_team_id(name), away:away_team_id(name)', { count: 'exact' })
      .in('league_id', leagueIds.length ? leagueIds : ['00000000-0000-0000-0000-000000000000'])
      .in('status', statuses);
    if (teamIds) {
      const ids = teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000'];
      q = q.or(`home_team_id.in.(${ids.join(',')}),away_team_id.in.(${ids.join(',')})`);
    }
    return q;
  };

  const { count } = await buildQuery().range(0, 0);
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pageCount);
  const { data: matches } = await buildQuery()
    .order('scheduled_at', { ascending: asc })
    .range((current - 1) * size, current * size - 1);

  const qs = (over: Partial<SearchParams>) => {
    const p = new URLSearchParams();
    const merged = { tab, q: fQ, league: fLeague, size: String(size), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Jogos</h1>
      <p className="mb-4 text-sm text-gray-500">
        Jogos da temporada atual das ligas ativas (via API ESPN). Clique num jogo para ver todos os dados.
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded border p-4">
        <SyncButton />
        <MatchStatsButton />
        <TeamStatsButton />
      </div>

      <div className="mb-4 flex gap-1 border-b">
        <Link
          href={qs({ tab: 'proximos', page: '1' })}
          className={`border-b-2 px-3 py-2 text-sm ${tab === 'proximos' ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          Próximos Jogos
        </Link>
        <Link
          href={qs({ tab: 'encerrados', page: '1' })}
          className={`border-b-2 px-3 py-2 text-sm ${tab === 'encerrados' ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          Jogos Encerrados
        </Link>
      </div>

      {/* Filtros (GET — sem JS). tab preservado. */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <label className="flex flex-col text-sm">
          Time
          <input name="q" defaultValue={fQ} placeholder="Buscar time…" className="rounded border px-2 py-1 dark:bg-gray-900" />
        </label>
        <label className="flex flex-col text-sm">
          Liga
          <select name="league" defaultValue={fLeague} className="rounded border px-2 py-1 dark:bg-gray-900">
            <option value="">Todas</option>
            {cur?.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Por página
          <select name="size" defaultValue={String(size)} className="rounded border px-2 py-1 dark:bg-gray-900">
            {SIZES.map((sz) => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Filtrar
        </button>
      </form>

      <p className="mb-2 text-sm text-gray-500">{total} jogos</p>
      {!matches?.length && <p className="text-gray-500">Nenhum jogo.</p>}

      <ul className="flex flex-col gap-2">
        {matches?.map((m) => {
          const home = m.home as unknown as { name: string } | null;
          const away = m.away as unknown as { name: string } | null;
          const score = m.status === 'finished' ? ` ${m.home_score} x ${m.away_score} ` : ' x ';
          return (
            <li key={m.id}>
              <Link href={`/admin/jogos/${m.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-gray-50 dark:hover:bg-gray-900">
                <span className="text-sm">
                  {home?.name}
                  <span className="text-gray-400">{score}</span>
                  {away?.name}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(m.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link href={qs({ page: String(current - 1) })} className="text-blue-600 hover:underline">← Anterior</Link>
          ) : (
            <span className="text-gray-300">← Anterior</span>
          )}
          <span className="text-gray-500">Página {current} de {pageCount}</span>
          {current < pageCount ? (
            <Link href={qs({ page: String(current + 1) })} className="text-blue-600 hover:underline">Próxima →</Link>
          ) : (
            <span className="text-gray-300">Próxima →</span>
          )}
        </div>
      )}
    </main>
  );
}
