'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { register, type ActionState } from '../actions';
import { SubmitButton } from '@/components/auth/submit-button';

const initialState: ActionState = {};

export default function RegisterPage() {
  const [state, formAction] = useFormState(register, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Criar conta</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="full_name"
          type="text"
          placeholder="Nome completo (opcional)"
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
        <input
          name="username"
          type="text"
          placeholder="Usuário"
          required
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
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
          placeholder="Senha (mín. 8 caracteres)"
          required
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.message && (
          <p className="text-sm text-green-600">{state.message}</p>
        )}
        <SubmitButton>Cadastrar</SubmitButton>
      </form>

      <p className="text-sm">
        Já tem conta?{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
