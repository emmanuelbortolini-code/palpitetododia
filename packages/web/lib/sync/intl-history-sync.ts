import { createAdminClient } from '@/lib/supabase/admin';

// Atualização incremental do histórico de jogos de seleções (ESPN) -> international_matches,
// que semeia o Elo do modelo da Copa. O backfill completo (desde 2021) é feito uma vez pelo
// scripts/sync-wc-history.cjs; este sync (cron) só varre uma janela recente p/ capturar os
// resultados novos — inclusive os jogos da própria Copa (slug fifa.world) durante o torneio.

const SOCCER = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// slug ESPN -> importância (peso K do Elo).
const COMPS: Record<string, number> = {
  'fifa.friendly': 20,
  'fifa.worldq.uefa': 30, 'fifa.worldq.conmebol': 30, 'fifa.worldq.concacaf': 30,
  'fifa.worldq.afc': 30, 'fifa.worldq.caf': 30, 'fifa.worldq.ofc': 30,
  'uefa.nations': 30, 'concacaf.nations': 30,
  'uefa.euro': 40, 'conmebol.america': 40, 'caf.nations': 40, 'afc.asian': 40,
  'concacaf.gold': 35, 'ofc.nations': 35,
  'fifa.world': 50,
};

const ymd = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
const parseYmd = (s: string) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);

type Row = {
  espn_event_id: string; played_at: string; home_espn_id: string; away_espn_id: string;
  home_goals: number; away_goals: number; neutral: boolean; competition: string; importance: number;
};

async function fetchRange(slug: string, start: string, end: string, out: Map<string, Row>): Promise<void> {
  let j: any;
  try { j = await (await fetch(`${SOCCER}/${slug}/scoreboard?dates=${start}-${end}`)).json(); } catch { return; }
  const events: any[] = j?.events ?? [];
  if (events.length >= 100 && start !== end) {
    const mid = new Date((parseYmd(start).getTime() + parseYmd(end).getTime()) / 2);
    await fetchRange(slug, start, ymd(mid), out);
    await fetchRange(slug, ymd(new Date(mid.getTime() + 86_400_000)), end, out);
    return;
  }
  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    const hg = Number(home?.score), ag = Number(away?.score);
    if (!home?.team?.id || !away?.team?.id || !Number.isFinite(hg) || !Number.isFinite(ag)) continue;
    out.set(String(e.id), {
      espn_event_id: String(e.id), played_at: e.date,
      home_espn_id: String(home.team.id), away_espn_id: String(away.team.id),
      home_goals: hg, away_goals: ag, neutral: !!comp.neutralSite, competition: slug, importance: COMPS[slug],
    });
  }
}

export async function syncIntlHistory(sinceDays = 45): Promise<{ games: number }> {
  const supabase = createAdminClient();
  const end = new Date();
  const start = new Date(end.getTime() - sinceDays * 86_400_000);

  const byEvent = new Map<string, Row>();
  for (const slug of Object.keys(COMPS)) await fetchRange(slug, ymd(start), ymd(end), byEvent);

  const rows = [...byEvent.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('international_matches').upsert(rows.slice(i, i + 500), { onConflict: 'espn_event_id' });
    if (error) throw new Error(`international_matches: ${error.message}`);
  }
  return { games: rows.length };
}
