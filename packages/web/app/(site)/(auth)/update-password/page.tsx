'use client';

import { useFormState } from 'react-dom';
import { updatePassword, type ActionState } from '../actions';
import { SubmitButton } from '@/components/auth/submit-button';

const initialState: ActionState = {};

export default function UpdatePasswordPage() {
  const [state, formAction] = useFormState(updatePassword, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Nova senha</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="password"
          type="password"
          placeholder="Nova senha (mín. 8 caracteres)"
          required
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirme a senha"
          required
          className="rounded border px-3 py-2 dark:bg-gray-900"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <SubmitButton>Salvar</SubmitButton>
      </form>
    </main>
  );
}
