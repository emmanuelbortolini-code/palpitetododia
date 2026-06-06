'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { syncLeaguesAction, type ActionState } from '@/lib/actions/refdata';

export function SyncLeaguesButton() {
  const [state, formAction] = useFormState(syncLeaguesAction, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton>Sincronizar ligas do Brasil</SubmitButton>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
