import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { AcademyForm } from '@/components/academy/academy-form';
import { createAcademy } from '@/lib/actions/academy';

export default async function NovoAcademiaPage() {
  await requireStaff(['admin', 'content_manager']);

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
