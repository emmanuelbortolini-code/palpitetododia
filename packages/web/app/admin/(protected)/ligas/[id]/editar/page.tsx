import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeagueForm } from '@/components/admin/league-form';
import { updateLeague, linkProviderLeague, unlinkProviderLeague, type LeagueSource } from '@/lib/actions/refdata';

export const dynamic = 'force-dynamic';

type Tab = 'atual' | 'espn' | 'football';
type SearchParams = { tab?: string; q?: string };

const FORM_COLS =
  'id, name, name_en, name_es, slug, slug_en, slug_es, country_id, logo_url, gender_en, gender_br, gender_es, nicknames_pt, nicknames_en, nicknames_es';
const PROVIDER_COLS = 'external_api_source, external_api_id, api_football_data, espn_data';
const SRC: Record<LeagueSource, string> = { espn: 'espn', football: 'api_football' };
const LABEL: Record<LeagueSource, string> = { espn: 'ESPN', football: 'Football API' };

export default async function EditarLigaPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const [{ data: league }, { data: countries }, { data: aliases }] = await Promise.all([
    supabase.from('leagues').select(`${FORM_COLS}, ${PROVIDER_COLS}`).eq('id', params.id).maybeSingle(),
    supabase.from('countries').select('id, name').order('name', { ascending: true }),
    supabase.from('leagues').select('id, external_api_source, api_football_data, espn_data').eq('merged_into', params.id),
  ]);
  if (!league) notFound();

  const l = league as Record<string, unknown>;
  const tab: Tab = searchParams.tab === 'espn' || searchParams.tab === 'football' ? searchParams.tab : 'atual';

  const providerOf = (source: LeagueSource) => {
    const src = SRC[source];
    const dataCol = source === 'espn' ? 'espn_data' : 'api_football_data';
    const rows = [league, ...(aliases ?? [])] as Record<string, unknown>[];
    const row = rows.find((r) => r.external_api_source === src);
    if (!row) return null;
    return { data: (row[dataCol] ?? null) as Record<string, unknown> | null, isOrigin: row.id === league.id };
  };

  const TabLink = ({ to, children }: { to: Tab; children: React.ReactNode }) => (
    <Link
      href={`/admin/ligas/${params.id}/editar${to === 'atual' ? '' : `?tab=${to}`}`}
      className={`border-b-2 px-3 py-2 text-sm ${
        tab === to ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'
      }`}
    >
      {children}
    </Link>
  );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/ligas" className="text-sm text-blue-600 hover:underline">
        ← Ligas
      </Link>
      <h1 className="my-3 text-2xl font-bold">Editar {league.name as string}</h1>

      <div className="mb-5 flex gap-1 border-b">
        <TabLink to="atual">Dados Atuais</TabLink>
        <TabLink to="espn">Dados ESPN</TabLink>
        <TabLink to="football">Dados Football API</TabLink>
      </div>

      {tab === 'atual' && (
        <LeagueForm action={updateLeague.bind(null, league.id as string)} countries={countries ?? []} defaultValues={league as never} />
      )}

      {(tab === 'espn' || tab === 'football') && (
        <ProviderTab
          leagueId={params.id}
          leagueName={league.name as string}
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
  leagueId,
  leagueName,
  source,
  record,
  q,
  supabase,
}: {
  leagueId: string;
  leagueName: string;
  source: LeagueSource;
  record: { data: Record<string, unknown> | null; isOrigin: boolean } | null;
  q: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  if (record) {
    return (
      <div className="rounded border p-4">
        <p className="mb-3 text-sm text-gray-500">Vinculado · {LABEL[source]}</p>
        {!record.data && <p className="text-sm text-gray-400">Sem snapshot. Rode o enrich-leagues.</p>}
        {record.data && source === 'football' && <FootballView d={record.data} />}
        {record.data && source === 'espn' && <EspnView d={record.data} />}
        {!record.isOrigin && (
          <form action={unlinkProviderLeague.bind(null, leagueId, source)} className="mt-4">
            <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Desvincular {LABEL[source]}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Não vinculado: busca no pool da fonte.
  const { data: pool } = await supabase
    .from('leagues')
    .select('id, name')
    .is('merged_into', null)
    .eq('external_api_source', SRC[source])
    .neq('id', leagueId);
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const candidates = (pool ?? [])
    .filter((c) => (q ? norm((c as { name: string }).name).includes(norm(q)) : true))
    .slice(0, 25) as { id: string; name: string }[];

  return (
    <div className="rounded border p-4">
      <p className="mb-3 text-sm text-gray-500">Sem {LABEL[source]} vinculado. Busque e vincule.</p>
      <form method="get" className="mb-3 flex gap-2">
        <input type="hidden" name="tab" value={source} />
        <input name="q" defaultValue={q} placeholder="Buscar liga…" className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-900" />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">Buscar</button>
      </form>
      {!candidates.length && <p className="text-sm text-gray-500">Nenhum candidato.</p>}
      <div className="flex flex-col gap-1">
        {candidates.map((c) => (
          <form key={c.id} action={linkProviderLeague.bind(null, leagueId, source)} className="flex items-center gap-2 border-b py-1.5">
            <input type="hidden" name="provider_row_id" value={c.id} />
            <span className="flex-1 text-sm">{c.name}</span>
            <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">Vincular</button>
          </form>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function FootballView({ d }: { d: Record<string, unknown> }) {
  const country = d.country as { name?: string; flag?: string } | null;
  const seasons = (d.seasons as { year: number; current: boolean }[] | null) ?? [];
  return (
    <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
      <Row label="Nome">{(d.name as string) ?? '—'}</Row>
      <Row label="Tipo">{(d.type as string) ?? '—'}</Row>
      <Row label="Logo">
        {d.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={String(d.logo)} alt="" className="h-8 w-8 object-contain" />
        ) : '—'}
      </Row>
      <Row label="País">{country?.name ?? '—'}</Row>
      <Row label="Temporadas">
        {seasons.length ? (
          <div className="flex flex-wrap gap-1">
            {[...seasons].sort((a, b) => b.year - a.year).map((s) => (
              <span key={s.year} className={`rounded px-1.5 py-0.5 text-xs ${s.current ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                {s.year}
              </span>
            ))}
          </div>
        ) : '—'}
      </Row>
    </dl>
  );
}

type Standing = { rank: number | null; name: string; logo: string | null; gp: string; w: string; d: string; l: string; gf: string; ga: string; gd: string; points: string };

function EspnView({ d }: { d: Record<string, unknown> }) {
  const season = d.season as { year?: number } | null;
  const teams = (d.teams as { id: string; name: string; logo: string | null }[] | null) ?? [];
  const standings = (d.standings as Standing[] | null) ?? [];
  return (
    <div className="text-sm">
      <dl className="grid grid-cols-[120px_1fr] gap-y-1">
        <Row label="Nome">{(d.name as string) ?? '—'}</Row>
        <Row label="Slug">{(d.slug as string) ?? '—'}</Row>
        <Row label="Logo">
          {d.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(d.logo)} alt="" className="h-8 w-8 object-contain" />
          ) : '—'}
        </Row>
        <Row label="Temporada atual">{season?.year ?? '—'}</Row>
      </dl>

      {!!standings.length && (
        <>
          <p className="mb-1 mt-4 font-medium">Classificação ({season?.year ?? ''})</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-1">#</th>
                <th className="py-1">Time</th>
                <th className="py-1 text-center">P</th>
                <th className="py-1 text-center">J</th>
                <th className="py-1 text-center">V</th>
                <th className="py-1 text-center">E</th>
                <th className="py-1 text-center">D</th>
                <th className="py-1 text-center">GP</th>
                <th className="py-1 text-center">GC</th>
                <th className="py-1 text-center">SG</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-1 text-gray-500">{t.rank ?? i + 1}</td>
                  <td className="flex items-center gap-1 py-1">
                    {t.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logo} alt="" className="h-4 w-4 object-contain" />
                    )}
                    {t.name}
                  </td>
                  <td className="py-1 text-center font-medium">{t.points}</td>
                  <td className="py-1 text-center">{t.gp}</td>
                  <td className="py-1 text-center">{t.w}</td>
                  <td className="py-1 text-center">{t.d}</td>
                  <td className="py-1 text-center">{t.l}</td>
                  <td className="py-1 text-center">{t.gf}</td>
                  <td className="py-1 text-center">{t.ga}</td>
                  <td className="py-1 text-center">{t.gd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="mb-2 mt-4 text-gray-500">{teams.length} times participantes</p>
      <div className="grid grid-cols-2 gap-1">
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            {t.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logo} alt="" className="h-5 w-5 object-contain" />
            )}
            <span>{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
