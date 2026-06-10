import Link from 'next/link';
import { requireStaff, logoutStaff } from '@/lib/auth/staff';
import { AdminSidebarNav } from '@/components/admin/sidebar-nav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const isContent = staff.role === 'admin' || staff.role === 'content_manager';
  const isAffiliate = staff.role === 'admin' || staff.role === 'affiliate_manager';

  // Itens da sidebar filtrados pelo papel do staff.
  const items = [
    ...(isContent
      ? [
          { href: '/admin/noticias', label: 'Revisão' },
          { href: '/admin/academia', label: 'Academia' },
          { href: '/admin/palpites', label: 'Palpites' },
        ]
      : []),
    ...(staff.role === 'admin'
      ? [
          { href: '/admin/jogos', label: 'Jogos' },
          { href: '/admin/probabilidades', label: 'Probabilidades' },
          { href: '/admin/equipes', label: 'Equipes' },
          { href: '/admin/ligas', label: 'Ligas' },
        ]
      : []),
    ...(isAffiliate
      ? [
          { href: '/admin/sportsbooks', label: 'Casas de apostas' },
          { href: '/admin/afiliados', label: 'Afiliados' },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-1/5 min-w-[200px] flex-col border-r bg-gray-50 dark:bg-gray-900">
        <div className="border-b p-4">
          <Link href="/admin" className="font-bold">
            Painel
          </Link>
        </div>

        <nav className="flex-1 p-2">
          <AdminSidebarNav items={items} />
        </nav>

        <div className="border-t p-4 text-sm">
          <p className="mb-2 text-gray-500">
            {staff.full_name ?? staff.email}
            <br />
            <span className="text-xs">{staff.role}</span>
          </p>
          <form action={logoutStaff}>
            <button type="submit" className="text-gray-600 hover:text-gray-900 dark:text-gray-400">
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}
