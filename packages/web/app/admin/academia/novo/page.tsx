import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { AcademyForm } from '@/components/academy/academy-form';
import { createAcademy } from '@/lib/actions/academy';

export default async function NovoAcademiaPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin' && me.role !== 'content_manager') redirect('/dashboard');

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/academia" className="text-sm text-blue-600 hover:underline">
        ← Academia
      </Link>
      <h1 className="my-4 text-2xl font-bold">Novo artigo</h1>
      <AcademyForm action={createAcademy} submitLabel="Salvar rascunho" />
    </main>
  );
}
