'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { syncPlayerSeasonStatsAction, type ActionState } from '@/lib/actions/stats';

export function PlayerStatsButton() {
  const [state, formAction] = useFormState(syncPlayerSeasonStatsAction, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton>Sincronizar Artilheiros (ESPN)</SubmitButton>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
