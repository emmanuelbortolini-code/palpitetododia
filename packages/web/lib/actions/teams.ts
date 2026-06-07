'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { importTeamsFromCsv } from '@/lib/sync/csv-teams';
import { syncEspnActiveTeams, syncFootballMissingTeams } from '@/lib/sync/team-providers';

export type ActionState = { error?: string; message?: string };

export async function syncEspnTeamsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncEspnActiveTeams();
    revalidatePath('/admin/equipes');
    return {
      message: `${r.leagues} ligas: ${r.created} times novos, ${r.updated} atualizados, ${r.links} vínculos${r.skipped ? `, ${r.skipped} ligas sem ESPN` : ''}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar via ESPN.' };
  }
}

export async function syncFootballTeamsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireStaff(['admin']);
  try {
    const r = await syncFootballMissingTeams();
    revalidatePath('/admin/equipes');
    return {
      message: `${r.matched} times completados com dados do Football${r.skipped ? `, ${r.skipped} sem correspondência` : ''}${r.remaining ? `. Faltam ${r.remaining} — clique de novo.` : '.'}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao sincronizar via Football.' };
  }
}

export async function importTeamsCsvAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Selecione um arquivo CSV.' };
  }
  try {
    const text = await file.text();
    const r = await importTeamsFromCsv(text);
    revalidatePath('/admin/equipes');
    return {
      message: `${r.updated} equipes atualizadas${r.skipped ? `, ${r.skipped} ignoradas (ID não encontrado)` : ''}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao importar CSV.' };
  }
}

function optInt(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function optText(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

// "Apelido 1, Apelido 2" → ["Apelido 1", "Apelido 2"] (ou null).
function optList(v: FormDataEntryValue | null): string[] | null {
  const items = String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export async function updateTeam(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(['admin']);

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Nome é obrigatório.' };
  const countryId = String(formData.get('country_id') ?? '').trim();
  if (!countryId) return { error: 'Selecione o país.' };

  const next: Record<string, unknown> = {
    name,
    name_en: optText(formData.get('name_en')),
    name_es: optText(formData.get('name_es')),
    country_id: countryId,
    founded: optInt(formData.get('founded')),
    venue_name: optText(formData.get('venue_name')),
    venue_address: optText(formData.get('venue_address')),
    venue_city: optText(formData.get('venue_city')),
    venue_capacity: optInt(formData.get('venue_capacity')),
    website: optText(formData.get('website')),
    gender_en: optText(formData.get('gender_en')),
    gender_br: optText(formData.get('gender_br')),
    gender_es: optText(formData.get('gender_es')),
    nicknames_pt: optList(formData.get('nicknames_pt')),
    nicknames_en: optList(formData.get('nicknames_en')),
    nicknames_es: optList(formData.get('nicknames_es')),
  };

  const supabase = createAdminClient();

  // Marca como `override` os campos que o staff de fato alterou — o sync não
  // sobrescreve esses depois (edição manual tem prioridade).
  const { data: cur } = await supabase
    .from('teams')
    .select(
      'overrides, name, name_en, name_es, country_id, founded, venue_name, venue_address, venue_city, venue_capacity, website, gender_en, gender_br, gender_es, nicknames_pt, nicknames_en, nicknames_es',
    )
    .eq('id', id)
    .single();
  const curRow = cur as Record<string, unknown> | null;
  const ov = new Set(Array.isArray(curRow?.overrides) ? (curRow!.overrides as string[]) : []);
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const [k, v] of Object.entries(next)) {
    if (!curRow || !same(curRow[k], v)) ov.add(k);
  }

  const { error } = await supabase
    .from('teams')
    .update({ ...next, overrides: [...ov], updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/equipes');
  redirect('/admin/equipes');
}

// Vincula uma linha "alias" (ex.: ESPN) a uma linha canônica (ex.: API-Football),
// marcando-a como o MESMO clube. A alias some da listagem (merged_into setado).
export async function linkTeam(aliasId: string, formData: FormData) {
  await requireStaff(['admin']);
  const canonicalId = String(formData.get('canonical_id') ?? '').trim();
  if (!canonicalId || canonicalId === aliasId) return;
  const supabase = createAdminClient();
  await supabase
    .from('teams')
    .update({ merged_into: canonicalId, updated_at: new Date().toISOString() })
    .eq('id', aliasId);
  revalidatePath('/admin/equipes/match');
  revalidatePath('/admin/equipes');
}

// Desfaz o vínculo: a linha volta a ser um clube próprio na listagem.
export async function unlinkTeam(aliasId: string) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();
  await supabase
    .from('teams')
    .update({ merged_into: null, updated_at: new Date().toISOString() })
    .eq('id', aliasId);
  revalidatePath('/admin/equipes/match');
  revalidatePath('/admin/equipes');
}

// ── Vínculo por fonte na tela de editar (abas Dados ESPN / Dados Football API) ──

export type Source = 'espn' | 'football';
const SRC: Record<Source, { id: string; data: string; cols: string[] }> = {
  espn: { id: 'espn_id', data: 'espn_data', cols: ['name', 'logo_url'] },
  football: {
    id: 'api_football_id',
    data: 'api_football_data',
    cols: ['name', 'logo_url', 'founded', 'venue_name', 'venue_address', 'venue_city', 'venue_capacity', 'website', 'code'],
  },
};

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'time'
  );
}

// Vincula um registro de fonte (linha do pool) a este time: a linha vira alias
// (merged_into) e os campos VAZIOS de "Dados Atuais" são preenchidos com o
// snapshot dela (sem tocar no que foi editado à mão / está em overrides).
export async function linkProvider(teamId: string, source: Source, formData: FormData) {
  await requireStaff(['admin']);
  const rowId = String(formData.get('provider_row_id') ?? '').trim();
  if (!rowId || rowId === teamId) return;
  const cfg = SRC[source];
  const supabase = createAdminClient();

  const { data: chosen } = await supabase
    .from('teams')
    .select(`id, ${cfg.data}`)
    .eq('id', rowId)
    .single();
  const { data: team } = await supabase
    .from('teams')
    .select(`overrides, ${cfg.cols.join(', ')}`)
    .eq('id', teamId)
    .single();
  if (!chosen || !team) return;

  await supabase
    .from('teams')
    .update({ merged_into: teamId, updated_at: new Date().toISOString() })
    .eq('id', rowId);

  // Preenche só os campos vazios e não-editados.
  const snap = ((chosen as unknown as Record<string, unknown>)[cfg.data] ?? {}) as Record<string, unknown>;
  const t = team as unknown as Record<string, unknown>;
  const ov = new Set(Array.isArray(t.overrides) ? (t.overrides as string[]) : []);
  const fill: Record<string, unknown> = {};
  for (const c of cfg.cols) {
    const cur = t[c];
    const isEmpty = cur === null || cur === undefined || cur === '';
    if (isEmpty && !ov.has(c) && snap[c] != null && snap[c] !== '') fill[c] = snap[c];
  }
  if (Object.keys(fill).length) {
    await supabase
      .from('teams')
      .update({ ...fill, updated_at: new Date().toISOString() })
      .eq('id', teamId);
  }

  revalidatePath('/admin/equipes');
  redirect(`/admin/equipes/${teamId}/editar?tab=${source}`);
}

// Desvincula a fonte deste time. Se a fonte é um alias, ele volta ao pool. Se a
// fonte é a própria linha (origem), recria uma linha livre a partir do snapshot
// e limpa o id/snapshot da fonte neste time (os "Dados Atuais" continuam).
export async function unlinkProvider(teamId: string, source: Source) {
  await requireStaff(['admin']);
  const cfg = SRC[source];
  const supabase = createAdminClient();

  const { data: team } = await supabase
    .from('teams')
    .select(`id, country_id, ${cfg.id}, ${cfg.data}`)
    .eq('id', teamId)
    .single();
  if (!team) return;
  const t = team as unknown as Record<string, unknown>;
  const now = new Date().toISOString();

  if (t[cfg.id]) {
    // Origem: recria a linha de fonte no pool a partir do snapshot.
    const snap = (t[cfg.data] ?? {}) as Record<string, unknown>;
    const name = (snap.name as string) || 'Time';
    await supabase.from('teams').insert({
      country_id: t.country_id,
      name,
      slug: `${slugify(name)}-${source}-${t[cfg.id]}`,
      logo_url: (snap.logo_url as string) ?? null,
      [cfg.id]: t[cfg.id],
      [cfg.data]: snap,
    });
    await supabase
      .from('teams')
      .update({ [cfg.id]: null, [cfg.data]: null, updated_at: now })
      .eq('id', teamId);
  } else {
    // Alias: volta ao pool.
    await supabase
      .from('teams')
      .update({ merged_into: null, updated_at: now })
      .eq('merged_into', teamId)
      .not(cfg.id, 'is', null);
  }

  revalidatePath('/admin/equipes');
  redirect(`/admin/equipes/${teamId}/editar?tab=${source}`);
}
