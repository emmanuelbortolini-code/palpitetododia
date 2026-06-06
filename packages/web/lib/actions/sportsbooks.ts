'use server';

import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sportsbookSchema } from 'shared';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error?: string; message?: string };

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return `${base || 'casa'}-${randomUUID().slice(0, 6)}`;
}

function parseForm(formData: FormData) {
  return sportsbookSchema.safeParse({
    name: formData.get('name'),
    affiliate_url: formData.get('affiliate_url'),
    website_url: formData.get('website_url') || '',
    logo_url: formData.get('logo_url') || '',
    commission_type: formData.get('commission_type'),
    commission_rate: formData.get('commission_rate'),
    description: formData.get('description') || undefined,
  });
}

export async function createSportsbook(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase.from('sportsbooks').insert({
    name: d.name,
    slug: slugify(d.name),
    affiliate_url: d.affiliate_url,
    website_url: d.website_url || null,
    logo_url: d.logo_url || null,
    commission_type: d.commission_type,
    commission_rate: d.commission_rate,
    description: d.description || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/admin/sportsbooks');
  redirect('/admin/sportsbooks');
}

export async function updateSportsbook(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from('sportsbooks')
    .update({
      name: d.name,
      affiliate_url: d.affiliate_url,
      website_url: d.website_url || null,
      logo_url: d.logo_url || null,
      commission_type: d.commission_type,
      commission_rate: d.commission_rate,
      description: d.description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/sportsbooks');
  revalidatePath('/casas-de-apostas');
  redirect('/admin/sportsbooks');
}

export async function toggleSportsbookActive(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  const next = formData.get('is_active') === 'true';
  const supabase = createClient();
  await supabase
    .from('sportsbooks')
    .update({ is_active: next, updated_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/admin/sportsbooks');
  revalidatePath('/casas-de-apostas');
}
