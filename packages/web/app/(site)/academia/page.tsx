import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const difficultyLabel: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export default async function AcademiaPage() {
  const supabase = createClient();
  const { data: articles } = await supabase
    .from('academy_articles')
    .select('id, title, slug, difficulty, estimated_read_minutes, order_position')
    .eq('status', 'published')
    .order('order_position', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Academia</h1>

      {!articles?.length && (
        <p className="text-gray-500">Nenhum artigo publicado ainda.</p>
      )}

      <ul className="flex flex-col gap-4">
        {articles?.map((a) => (
          <li key={a.id} className="rounded border p-4">
            <Link href={`/academia/${a.slug}`} className="group">
              <h2 className="text-lg font-semibold group-hover:underline">
                {a.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {difficultyLabel[a.difficulty] ?? a.difficulty} ·{' '}
                {a.estimated_read_minutes} min de leitura
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
