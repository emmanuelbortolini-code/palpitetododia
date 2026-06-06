import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMatchOptions } from '@/lib/matches';
import { updatePrediction } from '@/lib/actions/predictions';
import { PredictionForm } from '@/components/predictions/prediction-form';

export const dynamic = 'force-dynamic';

export default async function EditPredictionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: prediction } = await supabase
    .from('predictions')
    .select(
      'id, match_id, prediction_type, prediction_value, confidence, odds, suggested_stake, description, tag_name, status, tipster_id',
    )
    .eq('id', params.id)
    .maybeSingle();

  // Só o autor edita, e só enquanto rascunho.
  if (!prediction || prediction.tipster_id !== user.id || prediction.status !== 'draft') {
    notFound();
  }

  const matches = await getMatchOptions();
  const action = updatePrediction.bind(null, prediction.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/freelancer/palpites" className="text-sm text-blue-600 hover:underline">
        ← Meus palpites
      </Link>
      <h1 className="my-4 text-2xl font-bold">Editar palpite</h1>
      <PredictionForm
        action={action}
        submitLabel="Salvar alterações"
        matches={matches}
        defaultValues={prediction}
      />
    </main>
  );
}
