'use server';

import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { articleSchema } from 'shared';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error?: string; message?: string };

function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240);
  // Sufixo curto garante unicidade sem precisar consultar artigos de outros
  // autores (que a RLS esconderia, deixando o INSERT falhar na constraint).
  return `${base || 'artigo'}-${randomUUID().slice(0, 6)}`;
}

function parseForm(formData: FormData) {
  return articleSchema.safeParse({
    title: formData.get('title'),
    excerpt: formData.get('excerpt'),
    content: formData.get('content'),
    cover_image_url: formData.get('cover_image_url') || '',
    meta_description: formData.get('meta_description') || undefined,
    keywords: formData.get('keywords') || undefined,
  });
}

export async function createArticle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { title, excerpt, content, cover_image_url, meta_description, keywords } =
    parsed.data;

  const { error } = await supabase.from('articles').insert({
    title,
    slug: slugify(title),
    excerpt,
    content,
    cover_image_url: cover_image_url || null,
    meta_description: meta_description || null,
    keywords: keywords || null,
    author_id: user.id,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/freelancer/noticias');
  redirect('/freelancer/noticias');
}

export async function updateArticle(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = createClient();
  const { title, excerpt, content, cover_image_url, meta_description, keywords } =
    parsed.data;

  const { error } = await supabase
    .from('articles')
    .update({
      title,
      excerpt,
      content,
      cover_image_url: cover_image_url || null,
      meta_description: meta_description || null,
      keywords: keywords || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/freelancer/noticias');
  redirect('/freelancer/noticias');
}

export async function submitForReview(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  const supabase = createClient();
  await supabase
    .from('articles')
    .update({ status: 'pending_review', updated_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/freelancer/noticias');
}

export async function approveArticle(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('articles')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by_admin_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidatePath('/admin/noticias');
  revalidatePath('/noticias');
}

export async function rejectArticle(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  const reason = String(formData.get('rejection_reason') || '');
  const supabase = createClient();
  await supabase
    .from('articles')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidatePath('/admin/noticias');
}
