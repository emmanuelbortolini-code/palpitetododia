import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/roles';
import { signOut } from '@/app/(site)/(auth)/actions';

const linkClass = 'text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300';

export async function Header() {
  const me = await getCurrentUser();
  // Header do site público/consumidor. Ferramentas de staff vivem só em /admin
  // (área separada, com auth própria) — nenhum link de /admin aparece aqui.
  const isFreelancer = me?.role === 'freelancer';

  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <Link href="/" className="font-bold">
          Palpite Todo Dia
        </Link>

        <Link href="/noticias" className={linkClass}>
          Notícias
        </Link>
        <Link href="/academia" className={linkClass}>
          Academia
        </Link>
        <Link href="/casas-de-apostas" className={linkClass}>
          Casas de apostas
        </Link>
        <Link href="/palpites" className={linkClass}>
          Palpites
        </Link>
        <Link href="/ranking" className={linkClass}>
          Ranking
        </Link>

        {isFreelancer && (
          <>
            <Link href="/freelancer/noticias" className={linkClass}>
              Minhas notícias
            </Link>
            <Link href="/freelancer/palpites" className={linkClass}>
              Meus palpites
            </Link>
          </>
        )}

        <div className="ml-auto flex items-center gap-4">
          {me ? (
            <>
              <Link href="/dashboard" className={linkClass}>
                {me.username}
              </Link>
              <form action={signOut}>
                <button type="submit" className={linkClass}>
                  Sair
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={linkClass}>
              Entrar
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
