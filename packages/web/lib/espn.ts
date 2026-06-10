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

/**
 * Detalhe completo de um time pela ESPN. O endpoint `sports.core` dispensa o
 * slug da liga e devolve a identidade completa (cores, logos, estádio inline).
 */
export async function fetchEspnTeamDetail(teamId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://sports.core.api.espn.com/v2/sports/soccer/teams/${teamId}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export type EspnStanding = {
  rank: number | null;
  teamId: string;
  name: string;
  logo: string | null;
  gp: string; w: string; d: string; l: string; gf: string; ga: string; gd: string; points: string;
};

/** Classificação (tabela) de um campeonato na ESPN. */
export async function fetchEspnStandings(slug: string): Promise<EspnStanding[]> {
  const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`, { cache: 'no-store' });
  if (!res.ok) return [];
  const j: any = await res.json();
  const entries: any[] = j?.children?.[0]?.standings?.entries ?? j?.standings?.entries ?? [];
  const val = (e: any, abbr: string) => e.stats?.find((x: any) => x.abbreviation === abbr)?.displayValue ?? '';
  return entries
    .map((e) => ({
      rank: Number(val(e, 'R')) || null,
      teamId: String(e.team?.id ?? ''),
      name: e.team?.displayName ?? e.team?.name ?? '',
      logo: e.team?.logos?.[0]?.href ?? null,
      gp: val(e, 'GP'), w: val(e, 'W'), d: val(e, 'D'), l: val(e, 'L'),
      gf: val(e, 'F'), ga: val(e, 'A'), gd: val(e, 'GD'), points: val(e, 'P'),
    }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}

// Record (total + splits casa/fora) de um time na temporada atual. O endpoint do
// time por liga traz tudo num item `total`: rank, V/E/D, GF/GA e os pares
// home*/away* (homeWins, awayPointsFor, etc.).
export type EspnTeamRecord = { stats: Record<string, number>; raw: unknown } | null;

export async function fetchEspnTeamRecord(slug: string, teamId: string): Promise<EspnTeamRecord> {
  const res = await fetch(`${ESPN_BASE}/${slug}/teams/${teamId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const j: any = await res.json();
  const items: any[] = j?.team?.record?.items ?? [];
  const total = items.find((it) => it.type === 'total') ?? items[0];
  if (!total) return null;
  const stats: Record<string, number> = {};
  for (const s of total.stats ?? []) if (typeof s.value === 'number') stats[s.name] = s.value;
  return { stats, raw: items };
}

// Estatísticas agregadas do time na temporada (categorias defensive/general/
// goalKeeping/offensive). Usado para clean sheets + o blob bruto.
export type EspnTeamSeasonStats = { cleanSheets: number | null; raw: unknown } | null;

export async function fetchEspnTeamSeasonStats(
  slug: string,
  season: number,
  teamId: string,
): Promise<EspnTeamSeasonStats> {
  const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${season}/types/1/teams/${teamId}/statistics`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const j: any = await res.json();
  const cats: any[] = j?.splits?.categories ?? [];
  const find = (cat: string, name: string) =>
    cats.find((c) => c.name === cat)?.stats?.find((s: any) => s.name === name)?.value ?? null;
  const cs = find('goalKeeping', 'cleanSheet');
  return { cleanSheets: typeof cs === 'number' ? cs : null, raw: cats };
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
  statistics: { name: string; label: string; home: string; away: string }[];
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

  // Estatísticas alinhadas mandante/visitante, indexadas pelo `name` estável da ESPN
  // (camelCase, ex.: possessionPct, totalShots) — mais robusto que o label localizado.
  const statMap = new Map<string, { name: string; label: string; home: string; away: string }>();
  for (const t of j?.boxscore?.teams ?? []) {
    const side = String(t.team?.id) === String(homeId) ? 'home' : String(t.team?.id) === String(awayId) ? 'away' : null;
    if (!side) continue;
    for (const st of t.statistics ?? []) {
      const name = st.name ?? st.label ?? '';
      const e = statMap.get(name) ?? { name, label: st.label ?? st.name ?? '', home: '', away: '' };
      e[side] = st.displayValue ?? '';
      statMap.set(name, e);
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
