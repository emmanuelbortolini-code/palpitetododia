import { syncIntlHistory } from '@/lib/sync/intl-history-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron diário do histórico de jogos de seleções (ESPN -> international_matches), janela
 * recente. Mantém o Elo do modelo da Copa fresco e incorpora os resultados do próprio
 * torneio (fifa.world) conforme acontecem. Roda antes do /api/cron/predictions, que gera
 * as previsões da Copa a partir deste histórico.
 * Protegido pelo header Authorization: Bearer <CRON_SECRET> (enviado pelo Vercel Cron).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncIntlHistory();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
