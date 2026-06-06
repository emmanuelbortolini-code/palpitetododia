import Link from 'next/link';
import { ArticleForm } from '@/components/news/article-form';
import { createArticle } from '@/lib/actions/news';

export default function NovaNoticiaPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link
        href="/freelancer/noticias"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Minhas notícias
      </Link>
      <h1 className="my-4 text-2xl font-bold">Nova notícia</h1>
      <ArticleForm action={createArticle} submitLabel="Salvar rascunho" />
    </main>
  );
}
