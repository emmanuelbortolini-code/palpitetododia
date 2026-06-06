import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/staff';
import { AcademyForm } from '@/components/academy/academy-form';
import { updateAcademy } from '@/lib/actions/academy';

export const dynamic = 'force-dynamic';

export default async function EditarAcademiaPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStaff(['admin', 'content_manager']);

  const supabase = createAdminClient();
  const { data: article } = await supabase
    .from('academy_articles')
    .select('id, title, content, cover_image_url, difficulty, order_position, estimated_read_minutes')
    .eq('id', params.id)
    .maybeSingle();

  if (!article) notFound();

  const action = updateAcademy.bind(null, article.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/academia" className="text-sm text-blue-600 hover:underline">
        ← Academia
      </Link>
      <h1 className="my-4 text-2xl font-bold">Editar artigo</h1>
      <AcademyForm action={action} submitLabel="Salvar alterações" defaultValues={article} />
    </main>
  );
}
