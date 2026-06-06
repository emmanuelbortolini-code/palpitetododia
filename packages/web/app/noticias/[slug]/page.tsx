import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NoticiaDetalhePage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  const { data: article } = await supabase
    .from('articles')
    .select('title, content, cover_image_url, published_at')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!article) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/noticias" className="text-sm text-blue-600 hover:underline">
        ← Notícias
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{article.title}</h1>
      {article.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.cover_image_url}
          alt=""
          className="mt-4 w-full rounded"
        />
      )}
      <article className="mt-6 whitespace-pre-wrap leading-relaxed">
        {article.content}
      </article>
    </main>
  );
}
