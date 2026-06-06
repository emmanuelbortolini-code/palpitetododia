import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { getMatchOptions } from '@/lib/matches';
import { createPrediction } from '@/lib/actions/predictions';
import { PredictionForm } from '@/components/predictions/prediction-form';

export const dynamic = 'force-dynamic';

export default async function NewPredictionPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const canTip = me.is_tipster || me.role === 'admin' || me.role === 'content_manager';
  if (!canTip) redirect('/dashboard');

  const matches = await getMatchOptions();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Novo palpite</h1>
      {!matches.length ? (
        <p className="text-gray-500">
          Nenhuma partida disponível. Sincronize os jogos em /admin/jogos primeiro.
        </p>
      ) : (
        <PredictionForm action={createPrediction} submitLabel="Salvar rascunho" matches={matches} />
      )}
    </main>
  );
}
