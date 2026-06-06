import { createAdminClient } from '@/lib/supabase/admin';

// tracking_events só aceita escrita via service_role (RLS sem policy de cliente),
// então o tracking roda com o admin client.

/**
 * Registra um clique de afiliado para a casa (por slug) e devolve a URL de destino.
 * É um único INSERT (atômico, seguro sob cliques concorrentes); as contagens são
 * derivadas de tracking_events na tela de analytics. Retorna null se a casa não
 * existir ou estiver inativa.
 */
export async function trackClick(
  slug: string,
  referrer: string | null,
): Promise<string | null> {
  const db = createAdminClient();

  const { data: book } = await db
    .from('sportsbooks')
    .select('id, affiliate_url, is_active')
    .eq('slug', slug)
    .maybeSingle();
  if (!book || !book.is_active) return null;

  await db.from('tracking_events').insert({
    sportsbook_id: book.id,
    event_type: 'click',
    referrer_url: referrer,
  });

  return book.affiliate_url;
}
