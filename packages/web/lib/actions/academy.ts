'use server';

import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { academySchema } from 'shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/staff';

export type ActionState = { error?: string; message?: string };

const CONTENT_ROLES = ['admin', 'content_manager'] as const;

function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return `${base || 'artigo'}-${randomUUID().slice(0, 6)}`;
}

function parseForm(formData: FormData) {
  return academySchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    cover_image_url: formData.get('cover_image_url') || '',
    difficulty: formData.get('difficulty') || 'beginner',
    order_position: formData.get('order_position') || 0,
    estimated_read_minutes: formData.get('estimated_read_minutes') || 5,
  });
}

export async function createAcademy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff([...CONTENT_ROLES]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const d = parsed.data;
  const { error } = await supabase.from('academy_articles').insert({
    title: d.title,
    slug: slugify(d.title),
    content: d.content,
    cover_image_url: d.cover_image_url || null,
    difficulty: d.difficulty,
    order_position: d.order_position,
    estimated_read_minutes: d.estimated_read_minutes,
    author_id: null,
  });
  if (error) return { error: error.message };

  revalidatePath('/admin/academia');
  redirect('/admin/academia');
}

export async function updateAcademy(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff([...CONTENT_ROLES]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const d = parsed.data;
  const { error } = await supabase
    .from('academy_articles')
    .update({
      title: d.title,
      content: d.content,
      cover_image_url: d.cover_image_url || null,
      difficulty: d.difficulty,
      order_position: d.order_position,
      estimated_read_minutes: d.estimated_read_minutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/academia');
  redirect('/admin/academia');
}

export async function publishAcademy(formData: FormData): Promise<void> {
  await requireStaff([...CONTENT_ROLES]);
  const id = String(formData.get('id'));
  const supabase = createAdminClient();
  await supabase
    .from('academy_articles')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by_admin_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidatePath('/admin/academia');
  revalidatePath('/academia');
}

export async function unpublishAcademy(formData: FormData): Promise<void> {
  await requireStaff([...CONTENT_ROLES]);
  const id = String(formData.get('id'));
  const supabase = createAdminClient();
  await supabase
    .from('academy_articles')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/admin/academia');
  revalidatePath('/academia');
}
