import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { TeamForm } from '@/components/admin/team-form';
import { NicknamesForm } from '@/components/admin/nicknames-form';
import { updateTeam, updateNicknames, linkProvider, unlinkProvider, type Source } from '@/lib/actions/teams';
import { fetchEspnTeamDetail } from '@/lib/espn';
import { CATEGORY_LABEL, CATEGORY_ORDER, HIDDEN_STATS, STAT_LABEL, formatStatValue } from '@/lib/stat-labels';

export const dynamic = 'force-dynamic';

type Tab = 'atual' | 'apelido' | 'temporada' | 'estatisticas' | 'espn' | 'football';
type SearchParams = { tab?: string; q?: string };

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

      {tab === 'estatisticas' && <StatsTab teamId={params.id} supabase={supabase} />}

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

async function StatsTab({
  teamId,
  supabase,
}: {
  teamId: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  const { data } = await supabase
    .from('team_season_stats')
    .select('*, league:league_id(name)')
    .eq('team_id', teamId)
    .order('season', { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];

  if (!rows.length) {
    return (
      <div className="rounded border p-4">
        <p className="text-sm text-gray-500">
          Sem estatísticas de temporada. Rode “Sincronizar Estatísticas de Temporada (ESPN)” em /admin/jogos.
        </p>
      </div>
    );
  }

  // Linha de tabela com J/V/E/D/GP/GC por recorte (geral, casa, fora).
  const num = (v: unknown) => (typeof v === 'number' ? v : '—');
  const Split = ({ label, p, r }: { label: string; p: string; r: Record<string, unknown> }) => (
    <tr className="border-t">
      <td className="py-1.5 pr-3 font-medium">{label}</td>
      <td className="py-1.5 text-center">{num(r[`${p}played`])}</td>
      <td className="py-1.5 text-center">{num(r[`${p}wins`])}</td>
      <td className="py-1.5 text-center">{num(r[`${p}draws`])}</td>
      <td className="py-1.5 text-center">{num(r[`${p}losses`])}</td>
      <td className="py-1.5 text-center">{num(r[`${p}gf`])}</td>
      <td className="py-1.5 text-center">{num(r[`${p}ga`])}</td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-5">
      {rows.map((r, idx) => {
        const league = (r.league as unknown as { name: string } | null)?.name ?? '—';
        return (
          <div key={idx} className="rounded border p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-medium">
                {league} <span className="text-gray-500">{r.season as number}</span>
              </p>
              <p className="text-sm text-gray-500">
                {r.rank ? `${r.rank as number}º` : ''} · {r.points as number} pts ·{' '}
                {r.clean_sheets != null ? `${r.clean_sheets as number} CS` : ''}
              </p>
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
                <Split label="Geral" p="" r={r} />
                <Split label="Casa" p="home_" r={r} />
                <Split label="Fora" p="away_" r={r} />
              </tbody>
            </table>
            <DetailedStats raw={r.raw} />
          </div>
        );
      })}
    </div>
  );
}

type EspnStat = { name: string; value: number; displayValue: string };
type EspnCategory = { name: string; stats: EspnStat[] };

/** Tabelas de estatísticas detalhadas da ESPN, agrupadas por categoria com rótulos PT. */
function DetailedStats({ raw }: { raw: unknown }) {
  const cats = ((raw as { statistics?: EspnCategory[] } | null)?.statistics ?? []).filter((c) => c.stats?.length);
  if (!cats.length) return null;
  const ordered = [...cats].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a.name) + 1 || 99) - (CATEGORY_ORDER.indexOf(b.name) + 1 || 99),
  );

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-gray-500">Estatísticas detalhadas (ESPN)</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {ordered.map((cat) => {
          const stats = cat.stats.filter((s) => !HIDDEN_STATS.has(s.name));
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
