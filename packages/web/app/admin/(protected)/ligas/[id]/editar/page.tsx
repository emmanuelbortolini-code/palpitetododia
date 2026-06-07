import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeagueForm } from '@/components/admin/league-form';
import { updateLeague } from '@/lib/actions/refdata';

export const dynamic = 'force-dynamic';

export default async function EditarLigaPage({ params }: { params: { id: string } }) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const [{ data: league }, { data: countries }] = await Promise.all([
    supabase
      .from('leagues')
      .select(
        'id, name, name_en, name_es, slug, slug_en, slug_es, country_id, logo_url, gender_en, gender_br, gender_es, nicknames_pt, nicknames_en, nicknames_es',
      )
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('countries').select('id, name').order('name', { ascending: true }),
  ]);

  if (!league) notFound();

  const action = updateLeague.bind(null, league.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/ligas" className="text-sm text-blue-600 hover:underline">
        ← Ligas
      </Link>
      <h1 className="my-4 text-2xl font-bold">Editar {league.name}</h1>
      <LeagueForm action={action} countries={countries ?? []} defaultValues={league as never} />
    </main>
  );
}
