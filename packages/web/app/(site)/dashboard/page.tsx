import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { getCurrentUser } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';

const TIER_CLASS: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-200 text-gray-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-indigo-100 text-indigo-800',
};

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  published: { label: 'Em aberto', cls: 'bg-blue-100 text-blue-700' },
  pending_result: { label: 'Aguardando', cls: 'bg-yellow-100 text-yellow-700' },
  won: { label: 'Green', cls: 'bg-green-100 text-green-700' },
  lost: { label: 'Red', cls: 'bg-red-100 text-red-700' },
  voided: { label: 'Anulado', cls: 'bg-gray-100 text-gray-600' },
};

export default async function DashboardPage() {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect('/login');
  }

  // user_points/user_credits: RLS permite ler só a própria linha. user_badges é
  // público. predictions: a RLS expõe os publicados a qualquer usuário.
  const supabase = createClient();
  const [{ data: points }, { data: credits }, { data: myBadges }, { data: latest }] =
    await Promise.all([
      supabase.from('user_points').select('total_points').eq('user_id', profile.id).maybeSingle(),
      supabase.from('user_credits').select('credits_available').eq('user_id', profile.id).maybeSingle(),
      supabase
        .from('user_badges')
        .select('earned_at, badge:badge_id(name, tier, description)')
        .eq('user_id', profile.id)
        .order('earned_at', { ascending: false }),
      supabase
        .from('predictions')
        .select(
          'id, prediction_type, prediction_value, odds, status, published_at, match:match_id(home:home_team_id(name), away:away_team_id(name)), tipster:tipster_id(username)',
        )
        .in('status', ['published', 'pending_result', 'won', 'lost', 'voided'])
        .order('published_at', { ascending: false })
        .limit(5),
    ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
            Sair
          </button>
        </form>
      </div>

      <p className="text-gray-600 dark:text-gray-400">
        Olá, <span className="font-medium">@{profile.username}</span>
      </p>

      {/* Desempenho */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border p-4 text-center">
          <p className="text-2xl font-bold">{points?.total_points ?? 0}</p>
          <p className="text-sm text-gray-500">Pontos</p>
        </div>
        <div className="rounded border p-4 text-center">
          <p className="text-2xl font-bold">{credits?.credits_available ?? 0}</p>
          <p className="text-sm text-gray-500">Créditos</p>
        </div>
      </div>

      {!!myBadges?.length && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-gray-500">Minhas conquistas</h2>
          <div className="flex flex-wrap gap-2">
            {myBadges.map((ub, i) => {
              const badge = ub.badge as unknown as {
                name: string;
                tier: string;
                description: string | null;
              } | null;
              return (
                <span
                  key={i}
                  title={badge?.description ?? ''}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    TIER_CLASS[badge?.tier ?? 'bronze'] ?? TIER_CLASS.bronze
                  }`}
                >
                  {badge?.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimos palpites publicados */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">Últimos palpites</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/palpites" className="text-blue-600 hover:underline">
              Ver todos
            </Link>
            <Link href="/ranking" className="text-blue-600 hover:underline">
              Ranking
            </Link>
          </div>
        </div>

        {!latest?.length && (
          <p className="text-sm text-gray-500">Nenhum palpite publicado ainda.</p>
        )}

        <ul className="flex flex-col gap-3">
          {latest?.map((p) => {
            const match = p.match as unknown as {
              home: { name: string } | null;
              away: { name: string } | null;
            } | null;
            const tipster = p.tipster as unknown as { username: string } | null;
            const badge = RESULT_BADGE[p.status] ?? RESULT_BADGE.published;
            return (
              <li key={p.id} className="rounded border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Link
                    href={`/palpites/${p.id}`}
                    className="font-medium hover:underline"
                  >
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
      </div>
    </main>
  );
}
