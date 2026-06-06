import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { SyncLeaguesButton } from '@/components/admin/sync-leagues-button';

export const dynamic = 'force-dynamic';

export default async function AdminLeaguesPage() {
  await requireStaff(['admin']);

  const supabase = createAdminClient();
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, is_active')
    .eq('external_api_source', 'espn')
    .order('name', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Ligas</h1>
      <p className="mb-6 text-sm text-gray-500">
        Sincronize as ligas do Brasil (Série A/B/C/D, estaduais, etc.) da API-Football.
      </p>

      <div className="mb-6">
        <SyncLeaguesButton />
      </div>

      <h2 className="mb-2 text-sm font-medium text-gray-500">
        {leagues?.length ?? 0} ligas cadastradas
      </h2>
      {!leagues?.length && <p className="text-gray-500">Nenhuma liga ainda.</p>}
      <ul className="flex flex-col gap-2">
        {leagues?.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded border p-3">
            <span>{l.name}</span>
            {!l.is_active && <span className="text-xs text-gray-400">(inativa)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
