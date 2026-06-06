'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { predictionSchema } from 'shared';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth/roles';
import { requireStaff } from '@/lib/auth/staff';
import { applyPredictionResult } from '@/lib/gamification/award';

export type ActionState = { error?: string; message?: string };

// Quem pode criar/publicar palpites: tipsters e staff de conteúdo.
function canTip(me: { role: string; is_tipster: boolean } | null): boolean {
  return (
    !!me &&
    (me.is_tipster || me.role === 'admin' || me.role === 'content_manager')
  );
}

function parseForm(formData: FormData) {
  return predictionSchema.safeParse({
    match_id: formData.get('match_id'),
    prediction_type: formData.get('prediction_type'),
    prediction_value: formData.get('prediction_value'),
    confidence: formData.get('confidence'),
    odds: formData.get('odds'),
    suggested_stake: formData.get('suggested_stake'),
    description: formData.get('description') || undefined,
    tag_name: formData.get('tag_name') || undefined,
  });
}

export async function createPrediction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (!canTip(me)) return { error: 'Sem permissão para criar palpites.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase.from('predictions').insert({
    match_id: d.match_id,
    tipster_id: me.id,
    prediction_type: d.prediction_type,
    prediction_value: d.prediction_value,
    confidence: d.confidence,
    odds: d.odds,
    suggested_stake: d.suggested_stake,
    description: d.description || null,
    tag_name: d.tag_name || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/freelancer/palpites');
  redirect('/freelancer/palpites');
}

export async function updatePrediction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (!canTip(me)) return { error: 'Sem permissão.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from('predictions')
    .update({
      match_id: d.match_id,
      prediction_type: d.prediction_type,
      prediction_value: d.prediction_value,
      confidence: d.confidence,
      odds: d.odds,
      suggested_stake: d.suggested_stake,
      description: d.description || null,
      tag_name: d.tag_name || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/freelancer/palpites');
  redirect('/freelancer/palpites');
}

export async function publishPrediction(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  const supabase = createClient();
  await supabase
    .from('predictions')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidatePath('/freelancer/palpites');
  revalidatePath('/palpites');
}

// Admin/staff marca o resultado de um palpite publicado.
export async function markResult(formData: FormData): Promise<void> {
  await requireStaff(['admin', 'content_manager']);

  const id = String(formData.get('id'));
  const result = String(formData.get('result')); // won | lost | voided
  if (!['won', 'lost', 'voided'].includes(result)) return;

  const supabase = createAdminClient();
  await supabase
    .from('predictions')
    .update({
      status: result,
      result_marked_at: new Date().toISOString(),
      result_marked_by_admin_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Concede pontos/créditos (se acerto) e recalcula stats do tipster.
  await applyPredictionResult(id);

  revalidatePath('/admin/palpites');
  revalidatePath('/palpites');
  revalidatePath('/ranking');
}
