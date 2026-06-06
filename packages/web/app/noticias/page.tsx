import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NoticiasPage() {
  const supabase = createClient();
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Notícias</h1>

      {!articles?.length && (
        <p className="text-gray-500">Nenhuma notícia publicada ainda.</p>
      )}

      <ul className="flex flex-col gap-6">
        {articles?.map((a) => (
          <li key={a.id} className="border-b pb-4">
            <Link href={`/noticias/${a.slug}`} className="group">
              <h2 className="text-xl font-semibold group-hover:underline">
                {a.title}
              </h2>
              <p className="mt-1 text-gray-600 dark:text-gray-400">{a.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
