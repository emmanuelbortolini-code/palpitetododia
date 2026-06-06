'use client';

import { useFormState } from 'react-dom';
import { staffLogin, type ActionState } from './actions';
import { SubmitButton } from '@/components/auth/submit-button';

const initialState: ActionState = {};

export default function StaffLoginPage() {
  const [state, formAction] = useFormState(staffLogin, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Painel da equipe</h1>
        <p className="text-sm text-gray-500">Acesso restrito ao staff.</p>
      </div>

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
    </main>
  );
}
