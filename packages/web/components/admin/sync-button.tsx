'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { syncNow, type ActionState } from '@/lib/actions/sync';

export function SyncButton() {
  const [state, formAction] = useFormState(syncNow, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton>Sincronizar com API-Football</SubmitButton>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
