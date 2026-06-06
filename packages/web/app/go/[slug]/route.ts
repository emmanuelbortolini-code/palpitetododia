import { trackClick } from '@/lib/affiliate';

export const dynamic = 'force-dynamic';

/** Redirect rastreado para a casa de apostas: registra o clique e encaminha. */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const referrer = request.headers.get('referer');
  const dest = await trackClick(params.slug, referrer);
  if (!dest) {
    return Response.redirect(new URL('/casas-de-apostas', request.url), 302);
  }
  return Response.redirect(dest, 302);
}
