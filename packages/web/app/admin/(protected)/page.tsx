import { requireStaff } from '@/lib/auth/staff';

export default async function AdminHomePage() {
  const staff = await requireStaff();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Painel da equipe</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Bem-vindo, {staff.full_name ?? staff.email}. Use o menu acima para gerenciar
        conteúdo, palpites e casas de apostas.
      </p>
    </main>
  );
}
