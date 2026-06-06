import { syncMatches } from '@/lib/sync/matches';

export const dynamic = 'force-dynamic';

/**
 * Cron diário de sincronização de partidas (configurar no Vercel via vercel.json).
 * Protegido pelo header Authorization: Bearer <CRON_SECRET>.
 * O Vercel Cron envia esse header automaticamente.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncMatches();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
