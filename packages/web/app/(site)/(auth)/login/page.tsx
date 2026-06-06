'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { login, type ActionState } from '../actions';
import { SubmitButton } from '@/components/auth/submit-button';

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Entrar</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          required
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          required
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <SubmitButton>Entrar</SubmitButton>
      </form>

      <div className="flex justify-between text-sm">
        <Link href="/register" className="text-blue-600 hover:underline">
          Criar conta
        </Link>
        <Link href="/reset-password" className="text-blue-600 hover:underline">
          Esqueci a senha
        </Link>
      </div>
    </main>
  );
}
