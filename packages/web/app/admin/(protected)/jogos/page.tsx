import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/staff';
import { SyncButton } from '@/components/admin/sync-button';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  live: 'Ao vivo',
  finished: 'Encerrada',
  postponed: 'Adiada',
  cancelled: 'Cancelada',
};

export default async function AdminMatchesPage() {
  await requireStaff(['admin']);

  const supabase = createAdminClient();
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true });

  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, scheduled_at, status, home_score, away_score, home:home_team_id(name), away:away_team_id(name)',
    )
    .order('scheduled_at', { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Jogos</h1>
      <p className="mb-4 text-sm text-gray-500">
        {count ?? 0} partidas no banco. O sync puxa a liga/temporada configuradas em
        env (API_FOOTBALL_LEAGUE_ID / API_FOOTBALL_SEASON).
      </p>

      <div className="mb-6 rounded border p-4">
        <SyncButton />
      </div>

      {!matches?.length && <p className="text-gray-500">Nenhuma partida sincronizada.</p>}

      <ul className="flex flex-col gap-2">
        {matches?.map((m) => {
          const home = m.home as unknown as { name: string } | null;
          const away = m.away as unknown as { name: string } | null;
          const score =
            m.status === 'finished' ? ` ${m.home_score} x ${m.away_score} ` : ' x ';
          return (
            <li key={m.id} className="flex items-center justify-between rounded border p-3">
              <span className="text-sm">
                {home?.name}
                <span className="text-gray-400">{score}</span>
                {away?.name}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(m.scheduled_at).toLocaleDateString('pt-BR')} ·{' '}
                {STATUS_LABEL[m.status] ?? m.status}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
