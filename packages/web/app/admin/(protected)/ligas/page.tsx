import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { SyncLeaguesButton } from '@/components/admin/sync-leagues-button';
import { ImportLeaguesForm } from '@/components/admin/import-leagues-form';
import { setLeagueCurated } from '@/lib/actions/refdata';

export const dynamic = 'force-dynamic';

const SIZES = [10, 20, 50];

type SearchParams = {
  q?: string;
  country?: string;
  status?: string;
  page?: string;
  size?: string;
};

export default async function AdminLeaguesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const q = (searchParams.q ?? '').trim();
  const fCountry = searchParams.country ?? '';
  const fStatus = searchParams.status ?? ''; // '', 'ativas', 'inativas'
  const size = SIZES.includes(Number(searchParams.size)) ? Number(searchParams.size) : 20;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { data: countries } = await supabase
    .from('countries')
    .select('id, name')
    .order('name', { ascending: true });

  let query = supabase
    .from('leagues')
    .select('id, name, curated, country_id')
    .is('merged_into', null) // só canônicas (ESPN duplicadas ficam de fora)
    .order('curated', { ascending: false })
    .order('name', { ascending: true });
  if (q) query = query.ilike('name', `%${q}%`);
  if (fCountry) query = query.eq('country_id', fCountry);
  if (fStatus === 'ativas') query = query.eq('curated', true);
  if (fStatus === 'inativas') query = query.eq('curated', false);

  const { data: all } = await query;
  const total = all?.length ?? 0;
  const curatedCount = (all ?? []).filter((l) => l.curated).length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pageCount);
  const leagues = (all ?? []).slice((current - 1) * size, current * size);

  const qs = (over: Partial<SearchParams>) => {
    const p = new URLSearchParams();
    const merged = { q, country: fCountry, status: fStatus, size: String(size), ...over };
    for (const [k, val] of Object.entries(merged)) if (val) p.set(k, String(val));
    return `?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Ligas</h1>
      <p className="mb-6 text-sm text-gray-500">
        Ative as ligas que aparecem nos filtros de Equipes. As demais ficam ocultas.
      </p>

      <div className="mb-6">
        <SyncLeaguesButton />
      </div>

      <div className="mb-6 rounded border p-4">
        <ImportLeaguesForm />
      </div>

      {/* Filtros (GET — sem JS) */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          Nome
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar liga…"
            className="rounded border px-2 py-1 dark:bg-gray-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          País
          <select name="country" defaultValue={fCountry} className="rounded border px-2 py-1 dark:bg-gray-900">
            <option value="">Todos</option>
            {countries?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Status
          <select name="status" defaultValue={fStatus} className="rounded border px-2 py-1 dark:bg-gray-900">
            <option value="">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Por página
          <select name="size" defaultValue={String(size)} className="rounded border px-2 py-1 dark:bg-gray-900">
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Filtrar
        </button>
      </form>

      <h2 className="mb-2 text-sm font-medium text-gray-500">
        {curatedCount} ativas de {total} no filtro
      </h2>
      {!leagues.length && <p className="text-gray-500">Nenhuma liga.</p>}
      <ul className="flex flex-col gap-1">
        {leagues.map((l) => (
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

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link href={qs({ page: String(current - 1) })} className="text-blue-600 hover:underline">
              ← Anterior
            </Link>
          ) : (
            <span className="text-gray-300">← Anterior</span>
          )}
          <span className="text-gray-500">
            Página {current} de {pageCount}
          </span>
          {current < pageCount ? (
            <Link href={qs({ page: String(current + 1) })} className="text-blue-600 hover:underline">
              Próxima →
            </Link>
          ) : (
            <span className="text-gray-300">Próxima →</span>
          )}
        </div>
      )}
    </main>
  );
}
