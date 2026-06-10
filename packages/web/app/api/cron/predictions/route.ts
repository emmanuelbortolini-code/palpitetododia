import { syncPredictions } from '@/lib/sync/predictions';
import { syncWcPredictions } from '@/lib/sync/wc-predictions';

export const dynamic = 'force-dynamic';

/**
 * Cron diário de previsões: grava a previsão pré-jogo dos jogos agendados e pontua os
 * encerrados (preenche o placar real), fazendo a calibração persistida acumular sozinha.
 * Roda após o /api/cron/fetch-matches (que atualiza jogos e placares). Sem chamadas
 * externas — só lê team_season_stats/matches e escreve match_predictions.
 * Protegido pelo header Authorization: Bearer <CRON_SECRET> (enviado pelo Vercel Cron).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncPredictions();
    const wc = await syncWcPredictions();
    return Response.json({ ok: true, ...result, wcPredicted: wc.predicted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
