import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { SyncTeamsForm } from '@/components/admin/sync-teams-form';

export const dynamic = 'force-dynamic';

export default async function AdminTeamsPage() {
  await requireStaff(['admin']);

  const supabase = createAdminClient();
  const [{ data: leagues }, { data: teams }] = await Promise.all([
    supabase
      .from('leagues')
      .select('id, name')
      .eq('external_api_source', 'espn')
      .order('name', { ascending: true }),
    supabase
      .from('teams')
      .select('id, name, logo_url')
      .eq('external_api_source', 'espn')
      .order('name', { ascending: true }),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Equipes</h1>
      <p className="mb-6 text-sm text-gray-500">
        Escolha uma liga e a temporada para importar os times da API-Football.
      </p>

      <div className="mb-6">
        <SyncTeamsForm leagues={leagues ?? []} />
      </div>

      <h2 className="mb-2 text-sm font-medium text-gray-500">
        {teams?.length ?? 0} times cadastrados
      </h2>
      {!teams?.length && <p className="text-gray-500">Nenhum time ainda.</p>}
      <ul className="grid grid-cols-2 gap-2">
        {teams?.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded border p-2">
            {t.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logo_url} alt="" className="h-6 w-6 object-contain" />
            )}
            <span className="text-sm">{t.name}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
