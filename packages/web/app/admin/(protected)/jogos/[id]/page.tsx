import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEspnSummary, type EspnSummary } from '@/lib/espn';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada', live: 'Ao vivo', finished: 'Encerrada', postponed: 'Adiada', cancelled: 'Cancelada',
};

export default async function JogoDetalhePage({ params }: { params: { id: string } }) {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, scheduled_at, status, home_score, away_score, external_api_id, external_api_source, league_id, home:home_team_id(name, logo_url), away:away_team_id(name, logo_url), league:league_id(name)',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!match) notFound();

  const home = match.home as unknown as { name: string; logo_url: string | null } | null;
  const away = match.away as unknown as { name: string; logo_url: string | null } | null;
  const league = match.league as unknown as { name: string } | null;
  const finished = match.status === 'finished';

  // Slug ESPN da liga (alias mesclada na canônica).
  let summary: EspnSummary | null = null;
  if (match.external_api_source === 'espn' && match.external_api_id) {
    const { data: alias } = await supabase
      .from('leagues')
      .select('external_api_id')
      .eq('merged_into', match.league_id)
      .eq('external_api_source', 'espn')
      .maybeSingle();
    if (alias?.external_api_id) {
      try {
        summary = await fetchEspnSummary(alias.external_api_id, match.external_api_id);
      } catch {
        summary = null;
      }
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin/jogos" className="text-sm text-blue-600 hover:underline">← Jogos</Link>

      <div className="my-4 flex items-center justify-center gap-4 rounded border p-5">
        <Team name={home?.name} logo={home?.logo_url} />
        <div className="text-center">
          <div className="text-2xl font-bold">
            {finished ? `${match.home_score} x ${match.away_score}` : 'x'}
          </div>
          <div className="text-xs text-gray-500">{STATUS_LABEL[match.status] ?? match.status}</div>
        </div>
        <Team name={away?.name} logo={away?.logo_url} />
      </div>

      <h2 className="mb-2 font-semibold">Informações</h2>
      <dl className="grid grid-cols-[150px_1fr] gap-y-1 text-sm">
        <Row label="Liga">{league?.name ?? '—'}</Row>
        <Row label="Data/hora">{new Date(match.scheduled_at).toLocaleString('pt-BR')}</Row>
        <Row label="Status">{summary?.status ?? STATUS_LABEL[match.status] ?? match.status}</Row>
        <Row label="Estádio">{summary?.venue ?? '—'}</Row>
        {summary?.attendance != null && <Row label="Público">{summary.attendance.toLocaleString('pt-BR')}</Row>}
        {!!summary?.officials.length && <Row label="Árbitros">{summary.officials.join(', ')}</Row>}
        {!!summary?.broadcasts.length && <Row label="Transmissão">{summary.broadcasts.join(', ')}</Row>}
        {!!summary && <Row label="Confrontos diretos">{summary.headToHead}</Row>}
      </dl>

      {!summary && (
        <p className="mt-4 text-sm text-gray-400">
          Detalhes da ESPN indisponíveis para este jogo.
        </p>
      )}

      {summary && finished && !!summary.statistics.length && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Estatísticas (pós-jogo)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="py-1 text-right">{home?.name}</th>
                <th className="py-1 text-center font-medium"> </th>
                <th className="py-1 text-left">{away?.name}</th>
              </tr>
            </thead>
            <tbody>
              {summary.statistics.map((s) => (
                <tr key={s.label} className="border-t">
                  <td className="py-1 text-right font-medium">{s.home || '—'}</td>
                  <td className="py-1 text-center text-gray-500">{s.label}</td>
                  <td className="py-1 text-left font-medium">{s.away || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {summary && finished && !!summary.keyEvents.length && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Lances</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.keyEvents.map((e, i) => (
              <li key={i} className="flex gap-2 border-b py-1">
                <span className="w-10 shrink-0 text-gray-400">{e.time || '—'}</span>
                <span className="flex-1">
                  {e.text}
                  {e.team && <span className="text-gray-400"> · {e.team}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Team({ name, logo }: { name?: string; logo?: string | null }) {
  return (
    <div className="flex w-28 flex-col items-center gap-1 text-center">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-10 w-10 object-contain" />
      )}
      <span className="text-sm font-medium">{name ?? '—'}</span>
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
