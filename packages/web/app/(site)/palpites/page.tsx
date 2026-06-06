import Link from 'next/link';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  published: { label: 'Em aberto', cls: 'bg-blue-100 text-blue-700' },
  pending_result: { label: 'Aguardando', cls: 'bg-yellow-100 text-yellow-700' },
  won: { label: 'Green', cls: 'bg-green-100 text-green-700' },
  lost: { label: 'Red', cls: 'bg-red-100 text-red-700' },
  voided: { label: 'Anulado', cls: 'bg-gray-100 text-gray-600' },
};

export default async function PalpitesPage() {
  const supabase = createClient();
  // RLS predictions_select expõe publicados ao anon; mostramos publicados e já resolvidos.
  const { data: predictions } = await supabase
    .from('predictions')
    .select(
      'id, prediction_type, prediction_value, odds, confidence, status, published_at, match:match_id(home:home_team_id(name), away:away_team_id(name)), tipster:tipster_id(username)',
    )
    .in('status', ['published', 'pending_result', 'won', 'lost', 'voided'])
    .order('published_at', { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Palpites</h1>

      {!predictions?.length && (
        <p className="text-gray-500">Nenhum palpite publicado ainda.</p>
      )}

      <ul className="flex flex-col gap-3">
        {predictions?.map((p) => {
          const match = p.match as unknown as {
            home: { name: string } | null;
            away: { name: string } | null;
          } | null;
          const tipster = p.tipster as unknown as { username: string } | null;
          const badge = RESULT_BADGE[p.status] ?? RESULT_BADGE.published;
          return (
            <li key={p.id} className="rounded border p-3">
              <div className="mb-1 flex items-center justify-between">
                <Link href={`/palpites/${p.id}`} className="font-medium hover:underline">
                  {match?.home?.name} x {match?.away?.name}
                </Link>
                <span className={`rounded px-2 py-0.5 text-xs ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {PREDICTION_TYPE_LABELS[p.prediction_type] ?? p.prediction_type}:{' '}
                {p.prediction_value} · Odds {p.odds} · @{tipster?.username}
              </p>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
