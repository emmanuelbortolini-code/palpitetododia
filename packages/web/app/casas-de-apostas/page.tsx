import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CasasDeApostasPage() {
  const supabase = createClient();
  const { data: books } = await supabase
    .from('sportsbooks')
    .select('id, name, slug, logo_url, description')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Casas de apostas</h1>

      {!books?.length && (
        <p className="text-gray-500">Nenhuma casa disponível no momento.</p>
      )}

      <ul className="flex flex-col gap-4">
        {books?.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-4 rounded border p-4"
          >
            <div className="flex items-center gap-3">
              {b.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
              )}
              <div>
                <p className="font-semibold">{b.name}</p>
                {b.description && (
                  <p className="text-sm text-gray-500">{b.description}</p>
                )}
              </div>
            </div>
            <a
              href={`/go/${b.slug}`}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Acessar
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
