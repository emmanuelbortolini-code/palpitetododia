import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { publishPrediction } from '@/lib/actions/predictions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  pending_result: 'Aguardando resultado',
  won: 'Green',
  lost: 'Red',
  voided: 'Anulado',
  rejected: 'Rejeitado',
};

export default async function FreelancerPredictionsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const canTip = me.is_tipster || me.role === 'admin' || me.role === 'content_manager';
  if (!canTip) redirect('/dashboard');

  const supabase = createClient();
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, prediction_type, prediction_value, odds, status, created_at')
    .eq('tipster_id', me.id)
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus palpites</h1>
        <Link
          href="/freelancer/palpites/novo"
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Novo palpite
        </Link>
      </div>

      {!predictions?.length && <p className="text-gray-500">Nenhum palpite ainda.</p>}

      <ul className="flex flex-col gap-3">
        {predictions?.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded border p-3"
          >
            <div>
              <p className="font-medium">
                {PREDICTION_TYPE_LABELS[p.prediction_type] ?? p.prediction_type}:{' '}
                {p.prediction_value}
              </p>
              <p className="text-sm text-gray-500">
                Odds {p.odds} · {STATUS_LABEL[p.status] ?? p.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {p.status === 'draft' && (
                <>
                  <Link
                    href={`/freelancer/palpites/${p.id}/editar`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Editar
                  </Link>
                  <form action={publishPrediction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700"
                    >
                      Publicar
                    </button>
                  </form>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
