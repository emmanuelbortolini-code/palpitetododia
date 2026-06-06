import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ArticleForm } from '@/components/news/article-form';
import { updateArticle } from '@/lib/actions/news';

export const dynamic = 'force-dynamic';

export default async function EditarNoticiaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: article } = await supabase
    .from('articles')
    .select('id, title, excerpt, content, cover_image_url, meta_description, keywords, author_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!article || article.author_id !== user.id) {
    notFound();
  }

  // Liga o id da notícia à action (assinatura vira (prev, formData)).
  const action = updateArticle.bind(null, article.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link
        href="/freelancer/noticias"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Minhas notícias
      </Link>
      <h1 className="my-4 text-2xl font-bold">Editar notícia</h1>
      <ArticleForm
        action={action}
        submitLabel="Salvar alterações"
        defaultValues={article}
      />
    </main>
  );
}
