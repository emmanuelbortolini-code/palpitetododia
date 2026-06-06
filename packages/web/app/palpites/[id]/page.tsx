import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RESULT_LABEL: Record<string, string> = {
  published: 'Em aberto',
  pending_result: 'Aguardando resultado',
  won: 'Green',
  lost: 'Red',
  voided: 'Anulado',
};

export default async function PalpiteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from('predictions')
    .select(
      'id, prediction_type, prediction_value, odds, confidence, suggested_stake, description, status, published_at, match:match_id(scheduled_at, home_score, away_score, status, home:home_team_id(name), away:away_team_id(name)), tipster:tipster_id(username)',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!p) notFound();

  const match = p.match as unknown as {
    scheduled_at: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    home: { name: string } | null;
    away: { name: string } | null;
  } | null;
  const tipster = p.tipster as unknown as { username: string } | null;
  const finished = match?.status === 'finished';

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/palpites" className="text-sm text-blue-600 hover:underline">
        ← Palpites
      </Link>

      <h1 className="my-4 text-2xl font-bold">
        {match?.home?.name} x {match?.away?.name}
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        {match && new Date(match.scheduled_at).toLocaleString('pt-BR')}
        {finished && ` · ${match.home_score} x ${match.away_score}`}
      </p>

      <dl className="flex flex-col gap-2 rounded border p-4 text-sm">
        <Row label="Palpite">
          {PREDICTION_TYPE_LABELS[p.prediction_type] ?? p.prediction_type}:{' '}
          {p.prediction_value}
        </Row>
        <Row label="Odds">{p.odds}</Row>
        <Row label="Confiança">{p.confidence}%</Row>
        <Row label="Stake sugerida">{p.suggested_stake}</Row>
        <Row label="Tipster">@{tipster?.username}</Row>
        <Row label="Resultado">{RESULT_LABEL[p.status] ?? p.status}</Row>
      </dl>

      {p.description && <p className="mt-4 whitespace-pre-wrap">{p.description}</p>}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
