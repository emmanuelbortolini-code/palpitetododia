import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  const supabase = createClient();
  // tipster_stats tem leitura pública (RLS). Ranking por acertos e aproveitamento.
  const { data: stats } = await supabase
    .from('tipster_stats')
    .select(
      'total_predictions, total_won, total_lost, hit_rate, roi, average_odds, tipster:tipster_id(username, full_name)',
    )
    .gt('total_predictions', 0)
    .order('total_won', { ascending: false })
    .order('hit_rate', { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Ranking de tipsters</h1>

      {!stats?.length && (
        <p className="text-gray-500">
          Nenhum tipster com palpites resolvidos ainda.
        </p>
      )}

      {!!stats?.length && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">#</th>
              <th className="py-2">Tipster</th>
              <th className="py-2 text-right">Acertos</th>
              <th className="py-2 text-right">Aproveit.</th>
              <th className="py-2 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => {
              const tipster = s.tipster as unknown as {
                username: string;
                full_name: string | null;
              } | null;
              return (
                <tr key={i} className="border-b">
                  <td className="py-2 font-medium">{i + 1}</td>
                  <td className="py-2">
                    {tipster?.full_name ?? `@${tipster?.username}`}
                    <span className="block text-xs text-gray-400">
                      {s.total_won}V · {s.total_lost}D em {s.total_predictions}
                    </span>
                  </td>
                  <td className="py-2 text-right">{s.total_won}</td>
                  <td className="py-2 text-right">{s.hit_rate}%</td>
                  <td
                    className={`py-2 text-right ${
                      Number(s.roi) >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {s.roi}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
