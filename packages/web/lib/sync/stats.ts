import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnSummary } from '@/lib/espn';

export type MatchStatsResult = { processed: number; updated: number; skipped: number };

// name estável da ESPN (boxscore) -> sufixo da coluna em match_stats.
const NAME_TO_COL: Record<string, string> = {
  possessionPct: 'possession',
  totalShots: 'shots',
  shotsOnTarget: 'shots_on_target',
  wonCorners: 'corners',
  foulsCommitted: 'fouls',
  yellowCards: 'yellow',
  redCards: 'red',
  offsides: 'offsides',
  saves: 'saves',
};

const num = (v: string): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Mapa liga canônica -> slug ESPN (alias mesclada), padrão de fixtures.ts. */
async function espnSlugByCanon(supabase: ReturnType<typeof createAdminClient>) {
  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, curated, merged_into, external_api_source, external_api_id');
  if (error) throw new Error(`leagues: ${error.message}`);
  const slug = new Map<string, string>();
  for (const l of leagues ?? []) {
    if (l.merged_into && l.external_api_source === 'espn' && l.external_api_id) slug.set(l.merged_into, l.external_api_id);
  }
  const active = new Set((leagues ?? []).filter((l) => l.curated && !l.merged_into).map((l) => l.id));
  return { slug, active };
}

/**
 * Estatísticas por jogo (ESPN summary/boxscore) -> tabela match_stats. Só jogos
 * ENCERRADOS de fonte ESPN das ligas ATIVAS que ainda não têm stats. Sem teto na
 * ESPN, mas processa só o que falta (evita reprocessar).
 */
export async function syncMatchStats(limit = 500): Promise<MatchStatsResult> {
  const supabase = createAdminClient();
  const { slug, active } = await espnSlugByCanon(supabase);

  const { data: done } = await supabase.from('match_stats').select('match_id');
  const haveStats = new Set((done ?? []).map((r) => r.match_id as string));

  const { data: matches } = await supabase
    .from('matches')
    .select('id, league_id, external_api_id')
    .eq('status', 'finished')
    .eq('external_api_source', 'espn');

  const todo = (matches ?? [])
    .filter((m) => active.has(m.league_id) && slug.has(m.league_id) && m.external_api_id && !haveStats.has(m.id))
    .slice(0, limit);

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const m of todo) {
    let summary = null;
    try {
      summary = await fetchEspnSummary(slug.get(m.league_id)!, m.external_api_id as string);
    } catch {
      summary = null;
    }
    if (!summary || !summary.statistics.length) {
      skipped++;
      continue;
    }
    const row: Record<string, unknown> = {
      match_id: m.id,
      attendance: summary.attendance,
      raw: summary.statistics,
      synced_at: now,
    };
    for (const st of summary.statistics) {
      const col = NAME_TO_COL[st.name];
      if (!col) continue;
      row[`home_${col}`] = num(st.home);
      row[`away_${col}`] = num(st.away);
    }
    rows.push(row);
  }

  let updated = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from('match_stats').upsert(chunk, { onConflict: 'match_id' });
    if (error) throw new Error(`match_stats: ${error.message}`);
    updated += chunk.length;
  }

  return { processed: todo.length, updated, skipped };
}
