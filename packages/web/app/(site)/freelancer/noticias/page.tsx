import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitForReview } from '@/lib/actions/news';

export const dynamic = 'force-dynamic';

const statusLabel: Record<string, string> = {
  draft: 'Rascunho',
  pending_review: 'Em revisão',
  published: 'Publicado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
};

export default async function MinhasNoticiasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS já limita a leitura às próprias notícias (+ publicadas), mas filtramos
  // por author_id para não listar publicadas de outros autores.
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, status, rejection_reason')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minhas notícias</h1>
        <Link
          href="/freelancer/noticias/novo"
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nova notícia
        </Link>
      </div>

      {!articles?.length && (
        <p className="text-gray-500">Você ainda não criou notícias.</p>
      )}

      <ul className="flex flex-col gap-3">
        {articles?.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded border p-3"
          >
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-gray-500">
                {statusLabel[a.status] ?? a.status}
                {a.status === 'rejected' && a.rejection_reason && (
                  <span className="text-red-600"> — {a.rejection_reason}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/freelancer/noticias/${a.id}/editar`}
                className="text-sm text-blue-600 hover:underline"
              >
                Editar
              </Link>
              {(a.status === 'draft' || a.status === 'rejected') && (
                <form action={submitForReview}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="rounded bg-gray-800 px-2 py-1 text-sm text-white hover:bg-gray-900"
                  >
                    Enviar p/ revisão
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
