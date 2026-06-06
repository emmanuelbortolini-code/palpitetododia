import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cria um Supabase client a partir de uma URL e chave.
 * Factory genérica usada tanto pelo web quanto pelo mobile — cada app passa suas
 * próprias variáveis de ambiente.
 */
export function createSupabaseClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    throw new Error('Supabase URL e key são obrigatórios para criar o client.');
  }
  return createClient(url, key);
}

export type { SupabaseClient };
