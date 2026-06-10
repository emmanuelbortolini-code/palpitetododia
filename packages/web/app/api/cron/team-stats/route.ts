import { syncTeamSeasonStats } from '@/lib/sync/team-stats';

export const dynamic = 'force-dynamic';
// Faz muitas chamadas à ESPN (por liga rastreada x time); precisa de janela maior.
export const maxDuration = 300;

/**
 * Cron diário dos agregados de temporada dos times (ESPN -> team_season_stats), que
 * alimentam o modelo de probabilidade (força de ataque/defesa por mando). Roda antes do
 * /api/cron/predictions para que a previsão use força atualizada.
 * Protegido pelo header Authorization: Bearer <CRON_SECRET> (enviado pelo Vercel Cron).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncTeamSeasonStats();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
