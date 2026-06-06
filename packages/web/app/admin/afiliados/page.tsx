import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function AdminAffiliatesPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin' && me.role !== 'affiliate_manager') redirect('/dashboard');

  const supabase = createClient();

  const { data: sportsbooks } = await supabase
    .from('sportsbooks')
    .select('id, name, slug, is_active')
    .order('name', { ascending: true });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: totalClicks }, { count: weekClicks }, ...perBook] = await Promise.all([
    supabase
      .from('tracking_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'click'),
    supabase
      .from('tracking_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'click')
      .gte('created_at', sevenDaysAgo),
    // Contagem por casa derivada de tracking_events (fonte da verdade).
    ...(sportsbooks ?? []).map((b) =>
      supabase
        .from('tracking_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'click')
        .eq('sportsbook_id', b.id),
    ),
  ]);

  const books = (sportsbooks ?? [])
    .map((b, i) => ({ ...b, clicks: perBook[i]?.count ?? 0 }))
    .sort((a, b) => b.clicks - a.clicks);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Afiliados — cliques</h1>
      <p className="mb-6 text-sm text-gray-500">
        {totalClicks ?? 0} cliques no total · {weekClicks ?? 0} nos últimos 7 dias
      </p>

      {!books?.length && <p className="text-gray-500">Nenhuma casa cadastrada.</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">Casa</th>
            <th className="py-2">Link</th>
            <th className="py-2 text-right">Cliques</th>
          </tr>
        </thead>
        <tbody>
          {books?.map((b) => (
            <tr key={b.id} className="border-b">
              <td className="py-2">
                {b.name}
                {!b.is_active && (
                  <span className="ml-2 text-xs text-gray-400">(inativa)</span>
                )}
              </td>
              <td className="py-2 text-gray-500">/go/{b.slug}</td>
              <td className="py-2 text-right font-medium">{b.clicks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
