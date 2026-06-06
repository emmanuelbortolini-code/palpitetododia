'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string };

export function AdminSidebarNav({ items }: { items: Item[] }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              className={`block rounded px-3 py-2 text-sm ${
                active
                  ? 'bg-blue-600 font-medium text-white'
                  : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
