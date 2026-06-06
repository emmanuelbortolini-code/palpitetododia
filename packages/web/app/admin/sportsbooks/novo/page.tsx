import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { SportsbookForm } from '@/components/sportsbooks/sportsbook-form';
import { createSportsbook } from '@/lib/actions/sportsbooks';

export default async function NovaSportsbookPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin' && me.role !== 'affiliate_manager') redirect('/dashboard');

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/sportsbooks" className="text-sm text-blue-600 hover:underline">
        ← Casas de apostas
      </Link>
      <h1 className="my-4 text-2xl font-bold">Nova casa</h1>
      <SportsbookForm action={createSportsbook} submitLabel="Cadastrar" />
    </main>
  );
}
