import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { TeamForm } from '@/components/admin/team-form';
import { updateTeam } from '@/lib/actions/teams';

export const dynamic = 'force-dynamic';

export default async function EditarEquipePage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff(['admin']);

  const supabase = createAdminClient();
  const [{ data: team }, { data: countries }] = await Promise.all([
    supabase
      .from('teams')
      .select(
        'id, name, country_id, founded, venue_name, venue_address, venue_city, venue_capacity, website',
      )
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('countries').select('id, name').order('name', { ascending: true }),
  ]);

  if (!team) notFound();

  const action = updateTeam.bind(null, team.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/equipes" className="text-sm text-blue-600 hover:underline">
        ← Equipes
      </Link>
      <h1 className="my-4 text-2xl font-bold">Editar {team.name}</h1>
      <TeamForm action={action} countries={countries ?? []} defaultValues={team} />
    </main>
  );
}
