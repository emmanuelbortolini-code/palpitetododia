// Client da API pública (não-oficial) da ESPN para futebol. Sem chave e sem
// limite rígido. A ESPN organiza o futebol por SLUG de liga (ex.: bra.1).

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export type EspnTeam = { id: string; name: string; logo: string | null };

export type EspnSeason = { year: number; displayName: string } | null;

export type EspnLeagueData = {
  league: { id: string; name: string; slug: string; logo: string | null; season: EspnSeason };
  teams: EspnTeam[];
};

// Ligas brasileiras disponíveis na ESPN (todas do Brasil → country BR).
// Continentais (Libertadores/Sudamericana) ficam de fora: misturam países.
export const ESPN_BRAZIL_LEAGUES = [
  'bra.1',
  'bra.2',
  'bra.3',
  'bra.copa_do_brazil',
  'bra.camp.paulista',
  'bra.camp.carioca',
  'bra.camp.mineiro',
  'bra.camp.gaucho',
] as const;

/** Busca a liga + seus times pelo slug da ESPN (uma chamada traz os dois). */
export async function fetchEspnLeagueTeams(slug: string): Promise<EspnLeagueData> {
  const res = await fetch(`${ESPN_BASE}/${slug}/teams`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN ${slug}: HTTP ${res.status}`);
  const json = await res.json();
  const lg = json?.sports?.[0]?.leagues?.[0];
  if (!lg) throw new Error(`ESPN ${slug}: liga não encontrada`);

  const teams: EspnTeam[] = (lg.teams ?? []).map((t: any) => ({
    id: String(t.team.id),
    name: t.team.displayName ?? t.team.name,
    logo: t.team.logos?.[0]?.href ?? null,
  }));

  return {
    league: {
      id: String(lg.id),
      name: lg.name,
      slug,
      logo: lg.logos?.[0]?.href ?? null,
      season: lg.season ? { year: lg.season.year, displayName: lg.season.displayName } : null,
    },
    teams,
  };
}

// ── Jogos (scoreboard) ──────────────────────────────────────────────────────

export type EspnEvent = {
  id: string;
  date: string; // ISO com horário (UTC)
  state: string; // 'pre' | 'in' | 'post'
  statusName: string; // ex.: STATUS_FULL_TIME, STATUS_POSTPONED
  completed: boolean;
  homeId: string | null;
  awayId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

function parseEvent(e: any): EspnEvent | null {
  const c = e?.competitions?.[0];
  if (!c) return null;
  const comps = c.competitors ?? [];
  const h = comps.find((x: any) => x.homeAway === 'home');
  const a = comps.find((x: any) => x.homeAway === 'away');
  const num = (v: any) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
  const st = e.status?.type ?? {};
  return {
    id: String(e.id),
    date: e.date,
    state: st.state ?? 'pre',
    statusName: st.name ?? '',
    completed: !!st.completed,
    homeId: h ? String(h.team.id) : null,
    awayId: a ? String(a.team.id) : null,
    homeScore: h ? num(h.score) : null,
    awayScore: a ? num(a.score) : null,
  };
}

/**
 * Todos os jogos de uma liga ESPN num ano, via janelas de data. O scoreboard
 * limita a 100 eventos por resposta, então fazemos split recursivo do intervalo.
 */
export async function fetchEspnFixtures(slug: string, year: number): Promise<EspnEvent[]> {
  const out = new Map<string, EspnEvent>();
  async function range(start: Date, end: Date): Promise<void> {
    const res = await fetch(`${ESPN_BASE}/${slug}/scoreboard?dates=${ymd(start)}-${ymd(end)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN scoreboard ${slug}: HTTP ${res.status}`);
    const json = await res.json();
    const evs: any[] = json?.events ?? [];
    // Teto de 100: se bateu e a janela ainda é maior que ~2 dias, divide.
    if (evs.length >= 100 && end.getTime() - start.getTime() > 2 * 86400000) {
      const mid = new Date((start.getTime() + end.getTime()) / 2);
      await range(start, mid);
      await range(new Date(mid.getTime() + 86400000), end);
      return;
    }
    for (const e of evs) {
      const p = parseEvent(e);
      if (p) out.set(p.id, p);
    }
  }
  await range(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)));
  return [...out.values()];
}

export type EspnSummary = {
  status: string;
  venue: string | null;
  attendance: number | null;
  officials: string[];
  broadcasts: string[];
  headToHead: number;
  competitors: { homeAway: string; name: string; logo: string | null; score: string | null; winner: boolean }[];
  statistics: { label: string; home: string; away: string }[];
  keyEvents: { time: string; type: string; team: string | null; text: string }[];
};

/** Detalhe completo de um jogo (estatísticas, lances, público, árbitros). */
export async function fetchEspnSummary(slug: string, eventId: string): Promise<EspnSummary | null> {
  const res = await fetch(`${ESPN_BASE}/${slug}/summary?event=${eventId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const j: any = await res.json();
  const comp = j?.header?.competitions?.[0];
  if (!comp) return null;

  const competitors = (comp.competitors ?? []).map((c: any) => ({
    homeAway: c.homeAway,
    name: c.team?.displayName ?? c.team?.name ?? '',
    logo: c.team?.logos?.[0]?.href ?? null,
    score: c.score ?? null,
    winner: !!c.winner,
  }));
  const homeId = comp.competitors?.find((c: any) => c.homeAway === 'home')?.team?.id;
  const awayId = comp.competitors?.find((c: any) => c.homeAway === 'away')?.team?.id;

  // Estatísticas alinhadas mandante/visitante.
  const statMap = new Map<string, { label: string; home: string; away: string }>();
  for (const t of j?.boxscore?.teams ?? []) {
    const side = String(t.team?.id) === String(homeId) ? 'home' : String(t.team?.id) === String(awayId) ? 'away' : null;
    if (!side) continue;
    for (const st of t.statistics ?? []) {
      const label = st.label ?? st.name ?? '';
      const e = statMap.get(label) ?? { label, home: '', away: '' };
      e[side] = st.displayValue ?? '';
      statMap.set(label, e);
    }
  }

  const keyEvents = (j?.keyEvents ?? []).map((e: any) => ({
    time: e.clock?.displayValue ?? '',
    type: e.type?.text ?? '',
    team: e.team?.displayName ?? null,
    text: e.text ?? '',
  }));

  const broadcasts = (j?.broadcasts ?? [])
    .map((b: any) => b.media?.shortName ?? (Array.isArray(b.names) ? b.names.join('/') : null))
    .filter(Boolean) as string[];

  return {
    status: comp.status?.type?.description ?? '',
    venue: j?.gameInfo?.venue?.fullName ?? null,
    attendance: j?.gameInfo?.attendance ?? null,
    officials: (j?.gameInfo?.officials ?? []).map((o: any) => o.displayName).filter(Boolean),
    broadcasts,
    headToHead: (j?.headToHeadGames ?? []).length,
    competitors,
    statistics: [...statMap.values()],
    keyEvents,
  };
}
