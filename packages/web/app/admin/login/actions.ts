'use server';

import { redirect } from 'next/navigation';
import { loginStaff } from '@/lib/auth/staff';

export type ActionState = { error?: string };

export async function staffLogin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' };
  }

  const error = await loginStaff(email, password);
  if (error) return { error };

  redirect('/admin');
}
