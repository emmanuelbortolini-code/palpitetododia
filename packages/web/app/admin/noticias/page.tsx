import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { approveArticle, rejectArticle } from '@/lib/actions/news';

export const dynamic = 'force-dynamic';

export default async function AdminNoticiasPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin' && me.role !== 'content_manager') {
    redirect('/dashboard');
  }

  const supabase = createClient();
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, excerpt, author_id')
    .eq('status', 'pending_review')
    .order('updated_at', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Revisão de notícias</h1>

      {!articles?.length && (
        <p className="text-gray-500">Nenhuma notícia aguardando revisão.</p>
      )}

      <ul className="flex flex-col gap-4">
        {articles?.map((a) => (
          <li key={a.id} className="rounded border p-4">
            <p className="font-medium">{a.title}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {a.excerpt}
            </p>

            <div className="mt-3 flex flex-col gap-2">
              <form action={approveArticle}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                >
                  Aprovar e publicar
                </button>
              </form>

              <form action={rejectArticle} className="flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input
                  name="rejection_reason"
                  placeholder="Motivo da rejeição"
                  className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-900"
                />
                <button
                  type="submit"
                  className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                >
                  Rejeitar
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
