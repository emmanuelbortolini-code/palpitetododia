import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';

const TIER_CLASS: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-200 text-gray-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-indigo-100 text-indigo-800',
};

export default async function DashboardPage() {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect('/login');
  }

  // user_points/user_credits: RLS permite ler só a própria linha. user_badges é público.
  const supabase = createClient();
  const [{ data: points }, { data: credits }, { data: myBadges }] = await Promise.all([
    supabase.from('user_points').select('total_points').eq('user_id', profile.id).maybeSingle(),
    supabase.from('user_credits').select('credits_available').eq('user_id', profile.id).maybeSingle(),
    supabase
      .from('user_badges')
      .select('earned_at, badge:badge_id(name, tier, description)')
      .eq('user_id', profile.id)
      .order('earned_at', { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Logado como <span className="font-medium">{profile.email}</span>
        {' · '}
        <span className="font-medium">@{profile.username}</span>
        {' · role: '}
        <span className="font-medium">{profile.role}</span>
      </p>

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
      <form action={signOut}>
        <button
          type="submit"
          className="rounded bg-gray-800 px-4 py-2 font-medium text-white hover:bg-gray-900"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
