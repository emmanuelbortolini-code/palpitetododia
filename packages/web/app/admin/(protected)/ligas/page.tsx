import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { SyncLeaguesButton } from '@/components/admin/sync-leagues-button';
import { setLeagueCurated } from '@/lib/actions/refdata';

export const dynamic = 'force-dynamic';

type SearchParams = { q?: string };

export default async function AdminLeaguesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const q = (searchParams.q ?? '').trim();
  let query = supabase
    .from('leagues')
    .select('id, name, curated')
    .is('merged_into', null) // só canônicas (ESPN duplicadas ficam de fora)
    .order('curated', { ascending: false })
    .order('name', { ascending: true });
  if (q) query = query.ilike('name', `%${q}%`);
  const { data: leagues } = await query;

  const curatedCount = (leagues ?? []).filter((l) => l.curated).length;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Ligas</h1>
      <p className="mb-6 text-sm text-gray-500">
        Ative as ligas que aparecem nos filtros de Equipes. As demais ficam ocultas.
      </p>

      <div className="mb-6">
        <SyncLeaguesButton />
      </div>

      <form method="get" className="mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar liga…"
          className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-900"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">
          Buscar
        </button>
      </form>

      <h2 className="mb-2 text-sm font-medium text-gray-500">
        {curatedCount} ativas {q ? `· ${leagues?.length ?? 0} no filtro` : `de ${leagues?.length ?? 0}`}
      </h2>
      {!leagues?.length && <p className="text-gray-500">Nenhuma liga.</p>}
      <ul className="flex flex-col gap-1">
        {leagues?.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded border p-2.5">
            <span className={l.curated ? 'font-medium' : 'text-gray-500'}>{l.name}</span>
            <div className="flex items-center gap-3">
              <Link href={`/admin/ligas/${l.id}/editar`} className="text-sm text-blue-600 hover:underline">
                Editar
              </Link>
              <form action={setLeagueCurated.bind(null, l.id, !l.curated)}>
                <button
                  type="submit"
                  className={
                    l.curated
                      ? 'rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      : 'rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700'
                  }
                >
                  {l.curated ? 'Desativar' : 'Ativar'}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
