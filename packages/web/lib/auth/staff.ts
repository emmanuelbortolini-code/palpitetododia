import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { compareSync } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createAdminClient } from '@/lib/supabase/admin';

// Auth do staff é TOTALMENTE separada da auth de consumidor (Supabase Auth).
// Credenciais vivem em public.staff_users; a sessão é um JWT em cookie próprio,
// assinado com STAFF_SESSION_SECRET. Todo acesso ao banco aqui usa service-role.

export type StaffRole = 'content_manager' | 'affiliate_manager' | 'admin';

export type StaffUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: StaffRole;
};

const COOKIE = 'staff_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function secret(): Uint8Array {
  const s = process.env.STAFF_SESSION_SECRET;
  if (!s) throw new Error('STAFF_SESSION_SECRET não configurado.');
  return new TextEncoder().encode(s);
}

/**
 * Verifica credenciais contra public.staff_users e grava o cookie de sessão.
 * Retorna mensagem de erro (string) ou null em caso de sucesso.
 */
export async function loginStaff(
  email: string,
  password: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, email, full_name, role, password_hash, is_active')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (!staff || !staff.is_active || !compareSync(password, staff.password_hash)) {
    return 'E-mail ou senha inválidos.';
  }

  const token = await new SignJWT({
    email: staff.email,
    full_name: staff.full_name,
    role: staff.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(staff.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });

  await supabase
    .from('staff_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', staff.id);

  return null;
}

/** Lê e valida o cookie de sessão. Retorna o staff logado ou null. */
export async function getStaffUser(): Promise<StaffUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.sub as string,
      email: payload.email as string,
      full_name: (payload.full_name as string | null) ?? null,
      role: payload.role as StaffRole,
    };
  } catch {
    return null;
  }
}

/**
 * Garante que há um staff logado (opcionalmente com um dos roles dados).
 * Caso contrário, redireciona para /admin/login.
 */
export async function requireStaff(roles?: StaffRole[]): Promise<StaffUser> {
  const staff = await getStaffUser();
  if (!staff || (roles && !roles.includes(staff.role))) {
    redirect('/admin/login');
  }
  return staff;
}

export async function logoutStaff(): Promise<void> {
  'use server';
  cookies().delete(COOKIE);
  redirect('/admin/login');
}
