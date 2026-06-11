import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { TeamForm } from '@/components/admin/team-form';
import { NicknamesForm } from '@/components/admin/nicknames-form';
import { updateTeam, updateNicknames, linkProvider, unlinkProvider, type Source } from '@/lib/actions/teams';
import { fetchEspnTeamDetail } from '@/lib/espn';
import { CATEGORY_LABEL, CATEGORY_ORDER, HIDDEN_STATS, CUP_HIDDEN_STATS, PCT_STATS, STAT_LABEL, formatStatValue } from '@/lib/stat-labels';

export const dynamic = 'force-dynamic';

type Tab = 'atual' | 'apelido' | 'temporada' | 'estatisticas' | 'espn' | 'football';
type SearchParams = { tab?: string; q?: string; comp?: string };

const FORM_COLS =
  'id, name, name_en, name_es, country_id, founded, venue_name, venue_address, venue_city, venue_capacity, website, gender_br, gender_es, nicknames_pt, nicknames_en, nicknames_es';
const PROVIDER_COLS = 'api_football_id, espn_id, api_football_data, espn_data, country_id';

const SOURCE_LABEL: Record<Source, string> = { espn: 'ESPN API', football: 'FOOTBALL API' };
const SOURCE_ID_COL: Record<Source, string> = { espn: 'espn_id', football: 'api_football_id' };
const SOURCE_DATA_COL: Record<Source, string> = { espn: 'espn_data', football: 'api_football_data' };

// Chaves de "encanamento" da API que não são dados do time (referências internas).
const SKIP_KEYS = new Set(['$ref', 'links']);
const isImageUrl = (v: string) =>
  /^https?:\/\//.test(v) && (/\.(png|jpe?g|svg|gif|webp)(\?|$)/i.test(v) || /espncdn|media\.api-sports/.test(v));

/** Achata o JSON da API em pares [caminho, valor] de folhas primitivas. */
function flatten(obj: unknown, prefix = ''): [string, string | number | boolean][] {
  const out: [string, string | number | boolean][] = [];
  if (obj == null || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SKIP_KEYS.has(k)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) =>
        typeof item === 'object'
          ? out.push(...flatten(item, `${path}[${i}]`))
          : out.push([`${path}[${i}]`, item as string | number | boolean]),
      );
    } else if (typeof v === 'object') {
      out.push(...flatten(v, path));
    } else {
      out.push([path, v as string | number | boolean]);
    }
  }
  return out;
}

const CURRENT_SEASON = new Date().getFullYear();

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function score(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter(Boolean));
  const tb = new Set(norm(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export default async function EditarEquipePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const [{ data: team }, { data: countries }, { data: aliases }] = await Promise.all([
    supabase.from('teams').select(`${FORM_COLS}, ${PROVIDER_COLS}`).eq('id', params.id).maybeSingle(),
    supabase.from('countries').select('id, name').order('name', { ascending: true }),
    supabase
      .from('teams')
      .select('id, api_football_id, espn_id, api_football_data, espn_data')
      .eq('merged_into', params.id),
  ]);
  if (!team) notFound();

  const t = team as Record<string, unknown>;
  const tab: Tab = ['apelido', 'temporada', 'estatisticas', 'espn', 'football'].includes(searchParams.tab ?? '')
    ? (searchParams.tab as Tab)
    : 'atual';

  // Registro de cada fonte: a própria linha (se tem o id) ou um alias.
  const providerOf = (src: Source) => {
    const idCol = SOURCE_ID_COL[src];
    const dataCol = SOURCE_DATA_COL[src];
    if (t[idCol]) return { id: t[idCol] as string, data: (t[dataCol] ?? {}) as Record<string, unknown> };
    const a = (aliases ?? []).find((x) => (x as Record<string, unknown>)[idCol]);
    if (a) {
      const ar = a as Record<string, unknown>;
      return { id: ar[idCol] as string, data: (ar[dataCol] ?? {}) as Record<string, unknown> };
    }
    return null;
  };

  const TabLink = ({ to, children }: { to: Tab; children: React.ReactNode }) => (
    <Link
      href={`/admin/equipes/${params.id}/editar${to === 'atual' ? '' : `?tab=${to}`}`}
      className={`border-b-2 px-3 py-2 text-sm ${
        tab === to ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'
      }`}
    >
      {children}
    </Link>
  );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/equipes" className="text-sm text-blue-600 hover:underline">
        ← Equipes
      </Link>
      <h1 className="my-3 text-2xl font-bold">Editar {team.name as string}</h1>

      <div className="mb-5 flex gap-1 border-b">
        <TabLink to="atual">Dados Atuais</TabLink>
        <TabLink to="apelido">Apelido</TabLink>
        <TabLink to="temporada">Temporada</TabLink>
        <TabLink to="estatisticas">Estatísticas</TabLink>
        <TabLink to="espn">ESPN API</TabLink>
        <TabLink to="football">FOOTBALL API</TabLink>
      </div>

      {tab === 'atual' && (
        <TeamForm
          action={updateTeam.bind(null, team.id as string)}
          countries={countries ?? []}
          defaultValues={team as never}
        />
      )}

      {tab === 'apelido' && (
        <NicknamesForm action={updateNicknames.bind(null, team.id as string)} defaultValues={team as never} />
      )}

      {tab === 'temporada' && <SeasonTab teamId={params.id} supabase={supabase} />}

      {tab === 'estatisticas' && (
        <StatsTab
          teamId={params.id}
          espnId={providerOf('espn')?.id ?? null}
          comp={searchParams.comp ?? ''}
          supabase={supabase}
        />
      )}

      {(tab === 'espn' || tab === 'football') && (
        <ProviderTab
          teamId={params.id}
          teamName={team.name as string}
          countryId={t.country_id as string}
          source={tab}
          record={providerOf(tab)}
          q={searchParams.q ?? ''}
          supabase={supabase}
        />
      )}
    </main>
  );
}

async function ProviderTab({
  teamId,
  teamName,
  countryId,
  source,
  record,
  q,
  supabase,
}: {
  teamId: string;
  teamName: string;
  countryId: string;
  source: Source;
  record: { id: string; data: Record<string, unknown> } | null;
  q: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  if (record) {
    // ESPN: busca AO VIVO (grátis). FOOTBALL: lê do snapshot salvo (evita consumir o
    // limite diário do plano Free a cada abertura).
    let raw: Record<string, unknown> | null = null;
    let liveError = false;
    if (source === 'espn') {
      try {
        raw = await fetchEspnTeamDetail(record.id);
      } catch {
        liveError = true;
      }
    }
    const fields = flatten(raw ?? record.data);

    // Competições da temporada atual (ESPN só fornece 2026; AF cobre até 2024).
    let seasonComps: string[] = [];
    if (source === 'espn') {
      const { data: tl } = await supabase
        .from('team_leagues')
        .select('league:league_id(name)')
        .eq('team_id', teamId)
        .eq('season', CURRENT_SEASON);
      seasonComps = (tl ?? [])
        .map((r) => (r.league as unknown as { name: string } | null)?.name)
        .filter((n): n is string => !!n)
        .sort();
    }
    return (
      <div className="rounded border p-4">
        <p className="mb-3 text-sm text-gray-500">
          Vinculado · {SOURCE_LABEL[source]} id <span className="font-mono">{record.id}</span>
          {raw ? ' · dados ao vivo' : liveError ? ' · API indisponível (snapshot salvo)' : ' · snapshot salvo'}
        </p>
        {fields.length ? (
          <dl className="grid grid-cols-[200px_1fr] gap-y-1 text-sm">
            {fields.map(([key, value]) => (
              <FieldRow key={key} label={key} value={value} />
            ))}
          </dl>
        ) : (
          <p className="text-sm text-gray-400">Sem dados disponíveis.</p>
        )}
        {source === 'espn' && (
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium">Competições {CURRENT_SEASON}</p>
            {seasonComps.length ? (
              <ul className="text-sm text-gray-600 dark:text-gray-300">
                {seasonComps.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma competição {CURRENT_SEASON}.</p>
            )}
          </div>
        )}
        <form action={unlinkProvider.bind(null, teamId, source)} className="mt-4">
          <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Desvincular {SOURCE_LABEL[source]}
          </button>
        </form>
      </div>
    );
  }

  // Não vinculado: busca no pool da fonte.
  const idCol = SOURCE_ID_COL[source];
  const { data: pool } = await supabase
    .from('teams')
    .select('id, name, logo_url, country_id')
    .is('merged_into', null)
    .not(idCol, 'is', null)
    .neq('id', teamId);
  const candidates = (pool ?? [])
    .filter((c) => (c as { country_id: string }).country_id === countryId)
    .map((c) => ({ c: c as { id: string; name: string; logo_url: string | null }, sc: score(teamName, (c as { name: string }).name) }))
    .filter(({ c }) => (q ? norm(c.name).includes(norm(q)) : true))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 20);

  return (
    <div className="rounded border p-4">
      <p className="mb-3 text-sm text-gray-500">
        Sem {SOURCE_LABEL[source]} vinculado. Busque o mesmo clube na lista da fonte e vincule.
      </p>
      <form method="get" className="mb-3 flex gap-2">
        <input type="hidden" name="tab" value={source} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome…"
          className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-900"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">
          Buscar
        </button>
      </form>
      {!candidates.length && <p className="text-sm text-gray-500">Nenhum candidato.</p>}
      <div className="flex flex-col gap-1">
        {candidates.map(({ c, sc }) => (
          <form
            key={c.id}
            action={linkProvider.bind(null, teamId, source)}
            className="flex items-center gap-2 border-b py-1.5"
          >
            <input type="hidden" name="provider_row_id" value={c.id} />
            {c.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo_url} alt="" className="h-6 w-6 object-contain" />
            )}
            <span className="flex-1 text-sm">{c.name}</span>
            <span className="text-xs text-gray-400">{Math.round(sc * 100)}%</span>
            <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">
              Vincular
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number | boolean }) {
  const s = String(value);
  const isUrl = /^https?:\/\//.test(s);
  const isColor = /color/i.test(label) && /^#?[0-9a-f]{6}$/i.test(s);
  return (
    <>
      <dt className="break-all font-mono text-xs text-gray-500">{label}</dt>
      <dd>
        {isImageUrl(s) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s} alt="" className="h-10 w-10 object-contain" />
        ) : isColor ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded border" style={{ backgroundColor: `#${s.replace('#', '')}` }} />
            {s}
          </span>
        ) : isUrl ? (
          <a href={s} target="_blank" rel="noreferrer" className="break-all text-blue-600 hover:underline">
            {s}
          </a>
        ) : (
          s
        )}
      </dd>
    </>
  );
}

async function SeasonTab({
  teamId,
  supabase,
}: {
  teamId: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  const { data } = await supabase
    .from('team_leagues')
    .select('season, league:league_id(name)')
    .eq('team_id', teamId)
    .order('season', { ascending: false });
  const rows = (data ?? [])
    .map((r) => ({
      season: r.season as number,
      league: (r.league as unknown as { name: string } | null)?.name ?? '—',
    }))
    .sort((a, b) => b.season - a.season || a.league.localeCompare(b.league));

  return (
    <div className="rounded border p-4">
      <p className="mb-3 text-sm text-gray-500">Ligas e temporadas em que este time competiu.</p>
      {!rows.length && <p className="text-sm text-gray-500">Sem temporadas vinculadas.</p>}
      {rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 font-medium">Liga</th>
              <th className="py-1 font-medium">Ano</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="py-1.5">{r.league}</td>
                <td className="py-1.5 text-gray-500">{r.season}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---- Estatísticas de seleções (Copa): agregadas dos jogos internacionais ----
// Clubes têm team_season_stats (ESPN, por liga); seleções não (a liga da Copa é
// track_stats=false p/ não entrar no modelo doméstico, e o torneio mal começou). Para
// manter o MESMO padrão visual, agregamos international_matches (ciclo atual, desde 2024)
// por categoria de competição e montamos linhas no formato dos cards de clube. Sede neutra
// é comum em seleções → split Casa/Fora/Neutro. Calculado on-the-fly (sem tabela nova).
const INTL_CATEGORIES = [
  { label: 'Copa do Mundo', id: 'intl-mundo' },
  { label: 'Eliminatórias', id: 'intl-eliminatorias' },
  { label: 'Continental / Nações', id: 'intl-continental' },
  { label: 'Amistosos', id: 'intl-amistosos' },
];
function intlCategory(slug: string): string {
  if (slug === 'fifa.friendly') return 'Amistosos';
  if (slug === 'fifa.world') return 'Copa do Mundo';
  if (slug.startsWith('fifa.worldq') || slug === 'fifa.wcq.ply' || slug === 'uefa.euroq' || slug === 'afc.cupq')
    return 'Eliminatórias';
  return 'Continental / Nações';
}

type IntlRow = { home_espn_id: unknown; away_espn_id: unknown; home_goals: number; away_goals: number; neutral: boolean; competition: string };
type IntlAgg = { played: number; wins: number; draws: number; losses: number; gf: number; ga: number; cs: number };

async function loadNationalStatsRows(
  supabase: ReturnType<typeof createAdminClient>,
  espnId: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from('international_matches')
    .select('home_espn_id, away_espn_id, home_goals, away_goals, neutral, competition')
    .or(`home_espn_id.eq.${espnId},away_espn_id.eq.${espnId}`)
    .gte('played_at', '2024-01-01');
  const games = (data ?? []) as IntlRow[];
  if (!games.length) return [];

  const blank = (): IntlAgg => ({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cs: 0 });
  const bump = (a: IntlAgg, gf: number, ga: number) => {
    a.played++; a.gf += gf; a.ga += ga;
    if (gf > ga) a.wins++; else if (gf < ga) a.losses++; else a.draws++;
    if (ga === 0) a.cs++;
  };
  const cats = new Map<string, { tot: IntlAgg; home: IntlAgg; away: IntlAgg; neutral: IntlAgg }>();
  for (const g of games) {
    const isHome = String(g.home_espn_id) === String(espnId);
    const gf = isHome ? g.home_goals : g.away_goals;
    const ga = isHome ? g.away_goals : g.home_goals;
    const cat = intlCategory(g.competition);
    let e = cats.get(cat);
    if (!e) cats.set(cat, (e = { tot: blank(), home: blank(), away: blank(), neutral: blank() }));
    bump(e.tot, gf, ga);
    bump(g.neutral ? e.neutral : isHome ? e.home : e.away, gf, ga);
  }

  const split = (pfx: string, a: IntlAgg) => ({
    [`${pfx}played`]: a.played, [`${pfx}wins`]: a.wins, [`${pfx}draws`]: a.draws,
    [`${pfx}losses`]: a.losses, [`${pfx}gf`]: a.gf, [`${pfx}ga`]: a.ga,
  });
  return INTL_CATEGORIES.filter((c) => cats.get(c.label)?.tot.played).map((c) => {
    const e = cats.get(c.label)!;
    return {
      league: { name: c.label }, league_id: c.id, season: 'desde 2024',
      rank: null, points: null,
      played: e.tot.played, wins: e.tot.wins, draws: e.tot.draws, losses: e.tot.losses,
      gf: e.tot.gf, ga: e.tot.ga, gd: e.tot.gf - e.tot.ga,
      ...split('home_', e.home), ...split('away_', e.away), ...split('neutral_', e.neutral),
      clean_sheets: e.tot.cs, raw: null,
    };
  });
}

async function StatsTab({
  teamId,
  espnId,
  comp,
  supabase,
}: {
  teamId: string;
  espnId: string | null;
  comp: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  const { data } = await supabase
    .from('team_season_stats')
    .select('*, league:league_id(name)')
    .eq('team_id', teamId)
    .order('season', { ascending: false });
  const clubRows = (data ?? []) as Record<string, unknown>[];
  const nationalRows = espnId ? await loadNationalStatsRows(supabase, espnId) : [];
  const rows = [...clubRows, ...nationalRows];

  if (!rows.length) {
    return (
      <div className="rounded border p-4">
        <p className="text-sm text-gray-500">
          Sem estatísticas de temporada. Rode “Sincronizar Estatísticas de Temporada (ESPN)” em /admin/jogos.
        </p>
      </div>
    );
  }

  // Competições disponíveis (uma sub-aba por liga), na ordem em que aparecem.
  const leagues: { id: string; name: string }[] = [];
  for (const r of rows) {
    const id = r.league_id as string;
    if (!leagues.some((l) => l.id === id)) {
      leagues.push({ id, name: (r.league as unknown as { name: string } | null)?.name ?? '—' });
    }
  }
  // Com mais de uma competição, oferece a sub-aba "Consolidado" (soma de todas).
  const tabs =
    leagues.length > 1 ? [...leagues, { id: 'consolidado', name: 'Consolidado' }] : leagues;
  const selected = tabs.some((t) => t.id === comp) ? comp : tabs[0].id;

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1 border-b">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/admin/equipes/${teamId}/editar?tab=estatisticas&comp=${t.id}`}
              className={`border-b-2 px-3 py-1.5 text-sm ${
                t.id === selected ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}
      {selected === 'consolidado' ? (
        <ConsolidatedCard rows={rows} />
      ) : (
        <div className="flex flex-col gap-5">
          {rows
            .filter((r) => (r.league_id as string) === selected)
            .map((r, idx) => (
              <SeasonStatsCard key={idx} r={r} />
            ))}
        </div>
      )}
    </div>
  );
}

const numCell = (v: unknown) => (typeof v === 'number' ? v : '—');

/** Card de uma competição/temporada: cabeçalho + V/E/D/GP/GC (com splits se houver) + detalhes. */
function SeasonStatsCard({ r }: { r: Record<string, unknown> }) {
  const league = (r.league as unknown as { name: string } | null)?.name ?? '—';
  const hasSplits = r.home_wins != null; // copas não têm tabela → sem splits de V/E/D
  const header = [
    r.rank != null ? `${r.rank as number}º` : null,
    r.points != null ? `${r.points as number} pts` : null,
    r.clean_sheets != null ? `${r.clean_sheets as number} CS` : null,
  ].filter(Boolean);

  const Split = ({ label, p }: { label: string; p: string }) => (
    <tr className="border-t">
      <td className="py-1.5 pr-3 font-medium">{label}</td>
      <td className="py-1.5 text-center">{numCell(r[`${p}played`])}</td>
      <td className="py-1.5 text-center">{numCell(r[`${p}wins`])}</td>
      <td className="py-1.5 text-center">{numCell(r[`${p}draws`])}</td>
      <td className="py-1.5 text-center">{numCell(r[`${p}losses`])}</td>
      <td className="py-1.5 text-center">{numCell(r[`${p}gf`])}</td>
      <td className="py-1.5 text-center">{numCell(r[`${p}ga`])}</td>
    </tr>
  );

  return (
    <div className="rounded border p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-medium">
          {league} <span className="text-gray-500">{r.season as number}</span>
        </p>
        {header.length > 0 && <p className="text-sm text-gray-500">{header.join(' · ')}</p>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500">
            <th className="py-1 text-left font-medium"></th>
            <th className="py-1 font-medium">J</th>
            <th className="py-1 font-medium">V</th>
            <th className="py-1 font-medium">E</th>
            <th className="py-1 font-medium">D</th>
            <th className="py-1 font-medium">GP</th>
            <th className="py-1 font-medium">GC</th>
          </tr>
        </thead>
        <tbody>
          <Split label="Geral" p="" />
          {hasSplits && <Split label="Casa" p="home_" />}
          {hasSplits && <Split label="Fora" p="away_" />}
          {r.neutral_played != null && <Split label="Neutro" p="neutral_" />}
        </tbody>
      </table>
      <DetailedStats raw={r.raw} />
      <GamesList raw={r.raw} />
    </div>
  );
}

type ScheduleGame = { date: string; homeAway: 'home' | 'away'; gf: number; ga: number; opponent: string; result: 'W' | 'D' | 'L' };
const RESULT_LABEL: Record<string, string> = { W: 'V', D: 'E', L: 'D' };

/** Lista de jogos encerrados da competição (ligas e copas). */
function GamesList({ raw }: { raw: unknown }) {
  const games = (raw as { schedule?: ScheduleGame[] } | null)?.schedule;
  if (!games?.length) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-gray-500">Jogos ({games.length})</summary>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {games.map((g, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-2 text-gray-500">{g.date.slice(0, 10)}</td>
              <td className="py-1 pr-2 text-gray-500">{g.homeAway === 'home' ? 'Casa' : 'Fora'}</td>
              <td className="py-1 pr-2">{g.opponent}</td>
              <td className="py-1 pr-2 tabular-nums">{g.gf}–{g.ga}</td>
              <td className="py-1 font-medium">{RESULT_LABEL[g.result]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Soma J/V/E/D/GP/GC entre todas as competições do time (geral + casa + fora). */
function ConsolidatedCard({ rows }: { rows: Record<string, unknown>[] }) {
  const sum = (rs: Record<string, unknown>[], key: string) =>
    rs.reduce((s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
  const cols = ['played', 'wins', 'draws', 'losses', 'gf', 'ga'];
  const cleanSheets = sum(rows, 'clean_sheets');

  const Row = ({ label, p, bold }: { label: string; p: string; bold?: boolean }) => (
    <tr className={`border-t ${bold ? 'font-semibold' : ''}`}>
      <td className="py-1.5 pr-3">{label}</td>
      {cols.map((c) => (
        <td key={c} className="py-1.5 text-center">
          {sum(rows, `${p}${c}`)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="rounded border p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-medium">Todas as competições</p>
        <p className="text-sm text-gray-500">
          {rows.length} {rows.length === 1 ? 'competição' : 'competições'} · {cleanSheets} CS
        </p>
      </div>

      {/* Por competição + total */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500">
            <th className="py-1 text-left font-medium">Competição</th>
            <th className="py-1 font-medium">J</th>
            <th className="py-1 font-medium">V</th>
            <th className="py-1 font-medium">E</th>
            <th className="py-1 font-medium">D</th>
            <th className="py-1 font-medium">GP</th>
            <th className="py-1 font-medium">GC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="py-1.5 pr-3">{(r.league as unknown as { name: string } | null)?.name ?? '—'}</td>
              {cols.map((c) => (
                <td key={c} className="py-1.5 text-center">{numCell(r[c])}</td>
              ))}
            </tr>
          ))}
          <Row label="Total" p="" bold />
        </tbody>
      </table>

      {/* Total geral / casa / fora */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-gray-500">
            <th className="py-1 text-left font-medium"></th>
            <th className="py-1 font-medium">J</th>
            <th className="py-1 font-medium">V</th>
            <th className="py-1 font-medium">E</th>
            <th className="py-1 font-medium">D</th>
            <th className="py-1 font-medium">GP</th>
            <th className="py-1 font-medium">GC</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Geral" p="" />
          <Row label="Casa" p="home_" />
          <Row label="Fora" p="away_" />
          {rows.some((r) => r.neutral_played != null) && <Row label="Neutro" p="neutral_" />}
        </tbody>
      </table>

      <ConsolidatedDetailed rows={rows} />
    </div>
  );
}

/**
 * Estatísticas detalhadas somadas entre as competições. Só contagens são somáveis;
 * porcentagens/médias (não aditivas) e métricas quebradas em copa ficam de fora.
 */
function ConsolidatedDetailed({ rows }: { rows: Record<string, unknown>[] }) {
  const skip = new Set([...HIDDEN_STATS, ...CUP_HIDDEN_STATS]);
  const isPctOrAvg = (n: string) => n.endsWith('Pct') || PCT_STATS.has(n) || n.startsWith('avg');

  // category -> (statName -> soma)
  const totals = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const cats = (r.raw as { statistics?: EspnCategory[] } | null)?.statistics ?? [];
    for (const c of cats) {
      for (const s of c.stats ?? []) {
        if (skip.has(s.name) || isPctOrAvg(s.name) || typeof s.value !== 'number') continue;
        let m = totals.get(c.name);
        if (!m) totals.set(c.name, (m = new Map()));
        m.set(s.name, (m.get(s.name) ?? 0) + s.value);
      }
    }
  }
  const cats = [...totals.keys()].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
  );
  if (!cats.length) return null;

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm text-gray-500">Estatísticas detalhadas (ESPN) — soma das competições</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {cats.map((cat) => {
          const entries = [...totals.get(cat)!.entries()];
          return (
            <div key={cat}>
              <p className="mb-1 text-sm font-medium">{CATEGORY_LABEL[cat] ?? cat}</p>
              <table className="w-full text-sm">
                <tbody>
                  {entries.map(([name, value]) => (
                    <tr key={name} className="border-t">
                      <td className="py-1 pr-3 text-gray-600 dark:text-gray-300">{STAT_LABEL[name] ?? name}</td>
                      <td className="py-1 text-right tabular-nums">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </details>
  );
}

type EspnStat = { name: string; value: number; displayValue: string };
type EspnCategory = { name: string; stats: EspnStat[] };

/** Tabelas de estatísticas detalhadas da ESPN, agrupadas por categoria com rótulos PT. */
function DetailedStats({ raw }: { raw: unknown }) {
  const data = raw as { statistics?: EspnCategory[]; record?: unknown } | null;
  const cats = (data?.statistics ?? []).filter((c) => c.stats?.length);
  if (!cats.length) return null;
  // Copa não tem `record` (sem tabela). Lá escondemos V/E/D e cleanSheet (vêm errados).
  const isCup = data?.record == null;
  const hidden = isCup ? new Set([...HIDDEN_STATS, ...CUP_HIDDEN_STATS]) : HIDDEN_STATS;
  const ordered = [...cats].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a.name) + 1 || 99) - (CATEGORY_ORDER.indexOf(b.name) + 1 || 99),
  );

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-gray-500">Estatísticas detalhadas (ESPN)</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {ordered.map((cat) => {
          const stats = cat.stats.filter((s) => !hidden.has(s.name));
          if (!stats.length) return null;
          return (
            <div key={cat.name}>
              <p className="mb-1 text-sm font-medium">{CATEGORY_LABEL[cat.name] ?? cat.name}</p>
              <table className="w-full text-sm">
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.name} className="border-t">
                      <td className="py-1 pr-3 text-gray-600 dark:text-gray-300">{STAT_LABEL[s.name] ?? s.name}</td>
                      <td className="py-1 text-right tabular-nums">{formatStatValue(s.name, s.value, s.displayValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </details>
  );
}
