import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/staff';
import { publishAcademy, unpublishAcademy } from '@/lib/actions/academy';

export const dynamic = 'force-dynamic';

const statusLabel: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
};

export default async function AdminAcademiaPage() {
  await requireStaff(['admin', 'content_manager']);

  const supabase = createAdminClient();
  const { data: articles } = await supabase
    .from('academy_articles')
    .select('id, title, status, order_position')
    .order('order_position', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Academia</h1>
        <Link
          href="/admin/academia/novo"
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Novo artigo
        </Link>
      </div>

      {!articles?.length && (
        <p className="text-gray-500">Nenhum artigo ainda.</p>
      )}

      <ul className="flex flex-col gap-3">
        {articles?.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded border p-3"
          >
            <div>
              <p className="font-medium">
                <span className="mr-2 text-gray-400">#{a.order_position}</span>
                {a.title}
              </p>
              <p className="text-sm text-gray-500">
                {statusLabel[a.status] ?? a.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/academia/${a.id}/editar`}
                className="text-sm text-blue-600 hover:underline"
              >
                Editar
              </Link>
              {a.status === 'published' ? (
                <form action={unpublishAcademy}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="rounded bg-gray-700 px-2 py-1 text-sm text-white hover:bg-gray-800"
                  >
                    Despublicar
                  </button>
                </form>
              ) : (
                <form action={publishAcademy}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700"
                  >
                    Publicar
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
