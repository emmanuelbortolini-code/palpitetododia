import { syncEspnFixtures } from '@/lib/sync/fixtures';

export const dynamic = 'force-dynamic';

/**
 * Cron diário de sincronização de jogos (ESPN, ligas ativas, temporada atual).
 * Protegido pelo header Authorization: Bearer <CRON_SECRET>.
 * O Vercel Cron envia esse header automaticamente.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncEspnFixtures();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
