import { redirect } from 'next/navigation';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { markResult } from '@/lib/actions/predictions';

export const dynamic = 'force-dynamic';

export default async function AdminPredictionsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin' && me.role !== 'content_manager') redirect('/dashboard');

  const supabase = createClient();
  const { data: predictions } = await supabase
    .from('predictions')
    .select(
      'id, prediction_type, prediction_value, odds, status, match:match_id(home:home_team_id(name), away:away_team_id(name)), tipster:tipster_id(username)',
    )
    .in('status', ['published', 'pending_result'])
    .order('published_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Palpites — marcar resultado</h1>

      {!predictions?.length && (
        <p className="text-gray-500">Nenhum palpite aguardando resultado.</p>
      )}

      <ul className="flex flex-col gap-3">
        {predictions?.map((p) => {
          const match = p.match as unknown as {
            home: { name: string } | null;
            away: { name: string } | null;
          } | null;
          const tipster = p.tipster as unknown as { username: string } | null;
          return (
            <li key={p.id} className="rounded border p-3">
              <p className="font-medium">
                {match?.home?.name} x {match?.away?.name}
              </p>
              <p className="text-sm text-gray-500">
                {PREDICTION_TYPE_LABELS[p.prediction_type] ?? p.prediction_type}:{' '}
                {p.prediction_value} · Odds {p.odds} · @{tipster?.username}
              </p>
              <div className="mt-2 flex gap-2">
                {(['won', 'lost', 'voided'] as const).map((r) => (
                  <form action={markResult} key={r}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="result" value={r} />
                    <button
                      type="submit"
                      className="rounded bg-gray-700 px-2 py-1 text-sm text-white hover:bg-gray-800"
                    >
                      {r === 'won' ? 'Green' : r === 'lost' ? 'Red' : 'Anular'}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
