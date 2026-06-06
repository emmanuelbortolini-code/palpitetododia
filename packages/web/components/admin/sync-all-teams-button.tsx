'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { syncAllTeamsAction, type ActionState } from '@/lib/actions/teams';

export function SyncAllTeamsButton() {
  const [state, formAction] = useFormState(syncAllTeamsAction, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="w-64">
        <SubmitButton>Sincronizar todos os times</SubmitButton>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
