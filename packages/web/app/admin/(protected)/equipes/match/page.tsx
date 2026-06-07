import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkTeam, unlinkTeam } from '@/lib/actions/teams';

export const dynamic = 'force-dynamic';

type Team = {
  id: string;
  country_id: string;
  name: string;
  logo_url: string | null;
  api_football_id: string | null;
  espn_id: string | null;
  merged_into: string | null;
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Similaridade simples por tokens compartilhados (Jaccard) — ordena candidatos.
function score(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter(Boolean));
  const tb = new Set(norm(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export default async function MatchTeamsPage() {
  await requireStaff(['admin']);
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('teams')
    .select('id, country_id, name, logo_url, api_football_id, espn_id, merged_into');
  const teams = (data ?? []) as Team[];

  // Canônicas API-Football (destino de vínculo) e ESPN livres (a vincular).
  const canonicals = teams.filter((t) => !t.merged_into && t.api_football_id);
  const espnFree = teams.filter((t) => !t.merged_into && t.espn_id && !t.api_football_id);
  const linked = teams.filter((t) => t.merged_into);
  const canonicalById = new Map(canonicals.map((c) => [c.id, c]));
  // Para a lista de "vinculados", também resolve nome da canônica (pode ser ESPN-only).
  const byId = new Map(teams.map((t) => [t.id, t]));

  // Para cada ESPN livre, candidatos do mesmo país ordenados por similaridade.
  const rows = espnFree
    .map((e) => {
      const cands = canonicals
        .filter((c) => c.country_id === e.country_id)
        .map((c) => ({ c, sc: score(e.name, c.name) }))
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 20);
      return { e, cands, best: cands[0] };
    })
    .sort((a, b) => (b.best?.sc ?? 0) - (a.best?.sc ?? 0));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/admin/equipes" className="text-sm text-blue-600 hover:underline">
        ← Equipes
      </Link>
      <h1 className="my-3 text-2xl font-bold">Vincular times (ESPN ↔ API-Football)</h1>
      <p className="mb-6 text-sm text-gray-500">
        Cada time da ESPN abaixo pode ser o mesmo clube de um time do API-Football. Confirme o
        vínculo (a versão API-Football vira a oficial) ou deixe como está se for um clube à parte.
      </p>

      <h2 className="mb-2 font-semibold">A vincular ({rows.length})</h2>
      {!rows.length && <p className="text-gray-500">Nada pendente. 🎉</p>}
      <div className="flex flex-col gap-2">
        {rows.map(({ e, cands, best }) => (
          <form
            key={e.id}
            action={linkTeam.bind(null, e.id)}
            className="flex flex-wrap items-center gap-2 rounded border p-2"
          >
            <span className="flex min-w-[180px] items-center gap-2 text-sm font-medium">
              {e.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.logo_url} alt="" className="h-6 w-6 object-contain" />
              )}
              {e.name}
              <span className="text-xs text-gray-400">espn {e.espn_id}</span>
            </span>
            <span className="text-gray-400">→</span>
            <select
              name="canonical_id"
              defaultValue={best?.c.id ?? ''}
              className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-900"
            >
              <option value="">— manter separado —</option>
              {cands.map(({ c, sc }) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({Math.round(sc * 100)}%)
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
            >
              Vincular
            </button>
          </form>
        ))}
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Vinculados ({linked.length})</h2>
      {!linked.length && <p className="text-gray-500">Nenhum vínculo ainda.</p>}
      <table className="w-full text-sm">
        <tbody>
          {linked.map((t) => {
            const into = canonicalById.get(t.merged_into!) ?? byId.get(t.merged_into!);
            return (
              <tr key={t.id} className="border-b">
                <td className="py-1.5">{t.name}</td>
                <td className="py-1.5 text-gray-500">→ {into?.name ?? '—'}</td>
                <td className="py-1.5 text-right">
                  <form action={unlinkTeam.bind(null, t.id)}>
                    <button type="submit" className="text-blue-600 hover:underline">
                      Desfazer
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
