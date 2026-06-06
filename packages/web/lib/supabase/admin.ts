import { createSupabaseClient } from 'shared';

/**
 * Supabase client com a service_role key — IGNORA RLS.
 * Uso restrito a operações de sistema sem usuário final: sync da API-Football
 * (crons/webhooks) que escreve em leagues/teams/matches (escrita só via service_role).
 * NUNCA importar em código que rode no browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
