import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { SyncAllTeamsButton } from '@/components/admin/sync-all-teams-button';

export const dynamic = 'force-dynamic';

const SIZES = [10, 20, 50];
const SOURCE = 'api_football';

type SearchParams = {
  country?: string;
  league?: string;
  season?: string;
  page?: string;
  size?: string;
};

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const size = SIZES.includes(Number(searchParams.size)) ? Number(searchParams.size) : 20;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const fCountry = searchParams.country ?? '';
  const fLeague = searchParams.league ?? '';
  const fSeason = searchParams.season ?? '';

  // Vínculos time↔liga↔temporada (poucas centenas de linhas) — base dos filtros.
  const { data: links } = await supabase
    .from('team_leagues')
    .select('team_id, league_id, season, league:league_id(name)');

  const leagueOptions = new Map<string, string>();
  const seasonOptions = new Set<number>();
  for (const l of links ?? []) {
    const lg = l.league as unknown as { name: string } | null;
    if (lg) leagueOptions.set(l.league_id, lg.name);
    seasonOptions.add(l.season);
  }

  // team_ids que casam com os filtros de liga/temporada.
  let teamIdFilter: string[] | null = null;
  if (fLeague || fSeason) {
    const ids = new Set<string>();
    for (const l of links ?? []) {
      if (fLeague && l.league_id !== fLeague) continue;
      if (fSeason && String(l.season) !== fSeason) continue;
      ids.add(l.team_id);
    }
    teamIdFilter = [...ids];
  }

  const { data: countries } = await supabase
    .from('countries')
    .select('id, name')
    .order('name', { ascending: true });

  let query = supabase
    .from('teams')
    .select('id, name, logo_url, founded, venue_name')
    .eq('external_api_source', SOURCE)
    .order('name', { ascending: true });
  if (fCountry) query = query.eq('country_id', fCountry);
  if (teamIdFilter) query = query.in('id', teamIdFilter.length ? teamIdFilter : ['']);

  const { data: allTeams } = await query;
  const total = allTeams?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pageCount);
  const teams = (allTeams ?? []).slice((current - 1) * size, current * size);

  const qs = (over: Partial<SearchParams>) => {
    const p = new URLSearchParams();
    const merged = { country: fCountry, league: fLeague, season: fSeason, size: String(size), ...over };
    for (const [k, val] of Object.entries(merged)) if (val) p.set(k, String(val));
    return `?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Equipes</h1>
      <p className="mb-4 text-sm text-gray-500">
        Importe todos os times (Série A–D, temporadas 2022–2024) da API-Football.
      </p>

      <div className="mb-6">
        <SyncAllTeamsButton />
      </div>

      {/* Filtros (GET — sem JS) */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          País
          <select name="country" defaultValue={fCountry} className="rounded border px-2 py-1 dark:bg-gray-900">
            <option value="">Todos</option>
            {countries?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Liga
          <select name="league" defaultValue={fLeague} className="rounded border px-2 py-1 dark:bg-gray-900">
            <option value="">Todas</option>
            {[...leagueOptions].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Temporada
          <select name="season" defaultValue={fSeason} className="rounded border px-2 py-1 dark:bg-gray-900">
            <option value="">Todas</option>
            {[...seasonOptions].sort((a, b) => b - a).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Por página
          <select name="size" defaultValue={String(size)} className="rounded border px-2 py-1 dark:bg-gray-900">
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Filtrar
        </button>
      </form>

      <p className="mb-2 text-sm text-gray-500">{total} times</p>

      {!teams.length && <p className="text-gray-500">Nenhum time encontrado.</p>}

      <table className="w-full text-sm">
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="w-8 py-2">
                {t.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo_url} alt="" className="h-6 w-6 object-contain" />
                )}
              </td>
              <td className="py-2 font-medium">{t.name}</td>
              <td className="py-2 text-gray-500">{t.founded ?? '—'}</td>
              <td className="py-2 text-gray-500">{t.venue_name ?? '—'}</td>
              <td className="py-2 text-right">
                <Link href={`/admin/equipes/${t.id}/editar`} className="text-blue-600 hover:underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link href={qs({ page: String(current - 1) })} className="text-blue-600 hover:underline">
              ← Anterior
            </Link>
          ) : (
            <span className="text-gray-300">← Anterior</span>
          )}
          <span className="text-gray-500">
            Página {current} de {pageCount}
          </span>
          {current < pageCount ? (
            <Link href={qs({ page: String(current + 1) })} className="text-blue-600 hover:underline">
              Próxima →
            </Link>
          ) : (
            <span className="text-gray-300">Próxima →</span>
          )}
        </div>
      )}
    </main>
  );
}
