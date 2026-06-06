import { createClient } from '@/lib/supabase/server';

export type AppRole =
  | 'admin'
  | 'content_manager'
  | 'affiliate_manager'
  | 'freelancer';

export type CurrentUser = {
  id: string;
  email: string | null;
  username: string;
  full_name: string | null;
  role: AppRole;
  is_tipster: boolean;
};

/**
 * Retorna o usuário logado + seu perfil em public.users (lido via RLS: a policy
 * users_select permite ler a própria linha). Retorna null se não houver sessão.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, username, full_name, role, is_tipster')
    .eq('id', user.id)
    .single();

  return profile as CurrentUser | null;
}
