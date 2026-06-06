import Link from 'next/link';
import { requireStaff, logoutStaff } from '@/lib/auth/staff';

const linkClass = 'text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const isContent = staff.role === 'admin' || staff.role === 'content_manager';
  const isAffiliate = staff.role === 'admin' || staff.role === 'affiliate_manager';

  return (
    <>
      <header className="border-b bg-gray-50 dark:bg-gray-900">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 p-4">
          <Link href="/admin" className="font-bold">
            Painel
          </Link>

          {isContent && (
            <>
              <Link href="/admin/noticias" className={linkClass}>
                Revisão
              </Link>
              <Link href="/admin/academia" className={linkClass}>
                Academia
              </Link>
              <Link href="/admin/palpites" className={linkClass}>
                Palpites
              </Link>
            </>
          )}
          {staff.role === 'admin' && (
            <Link href="/admin/jogos" className={linkClass}>
              Jogos
            </Link>
          )}
          {isAffiliate && (
            <>
              <Link href="/admin/sportsbooks" className={linkClass}>
                Casas
              </Link>
              <Link href="/admin/afiliados" className={linkClass}>
                Afiliados
              </Link>
            </>
          )}

          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {staff.full_name ?? staff.email} · {staff.role}
            </span>
            <form action={logoutStaff}>
              <button type="submit" className={linkClass}>
                Sair
              </button>
            </form>
          </div>
        </nav>
      </header>
      {children}
    </>
  );
}
