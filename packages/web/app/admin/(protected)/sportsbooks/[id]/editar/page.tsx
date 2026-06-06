import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/staff';
import { SportsbookForm } from '@/components/sportsbooks/sportsbook-form';
import { updateSportsbook } from '@/lib/actions/sportsbooks';

export const dynamic = 'force-dynamic';

export default async function EditarSportsbookPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff(['admin', 'affiliate_manager']);

  const supabase = createAdminClient();
  const { data: book } = await supabase
    .from('sportsbooks')
    .select('id, name, affiliate_url, website_url, logo_url, commission_type, commission_rate, description')
    .eq('id', params.id)
    .maybeSingle();

  if (!book) notFound();

  const action = updateSportsbook.bind(null, book.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/sportsbooks" className="text-sm text-blue-600 hover:underline">
        ← Casas de apostas
      </Link>
      <h1 className="my-4 text-2xl font-bold">Editar casa</h1>
      <SportsbookForm action={action} submitLabel="Salvar alterações" defaultValues={book} />
    </main>
  );
}
