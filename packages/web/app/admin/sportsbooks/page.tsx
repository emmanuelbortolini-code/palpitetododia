import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { toggleSportsbookActive } from '@/lib/actions/sportsbooks';

export const dynamic = 'force-dynamic';

export default async function AdminSportsbooksPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin' && me.role !== 'affiliate_manager') redirect('/dashboard');

  const supabase = createClient();
  const { data: books } = await supabase
    .from('sportsbooks')
    .select('id, name, commission_type, commission_rate, is_active')
    .order('name', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Casas de apostas</h1>
        <Link
          href="/admin/sportsbooks/novo"
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nova casa
        </Link>
      </div>

      {!books?.length && <p className="text-gray-500">Nenhuma casa cadastrada.</p>}

      <ul className="flex flex-col gap-3">
        {books?.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-3 rounded border p-3"
          >
            <div>
              <p className="font-medium">
                {b.name}
                {!b.is_active && (
                  <span className="ml-2 text-xs text-gray-400">(inativa)</span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                {b.commission_type.toUpperCase()} · {b.commission_rate}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/sportsbooks/${b.id}/editar`}
                className="text-sm text-blue-600 hover:underline"
              >
                Editar
              </Link>
              <form action={toggleSportsbookActive}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="is_active" value={String(!b.is_active)} />
                <button
                  type="submit"
                  className="rounded bg-gray-700 px-2 py-1 text-sm text-white hover:bg-gray-800"
                >
                  {b.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
