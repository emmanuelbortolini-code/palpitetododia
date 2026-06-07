'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { syncEspnTeamsAction, syncFootballTeamsAction, type ActionState } from '@/lib/actions/teams';

export function SyncTeamsButtons() {
  const [espn, espnAction] = useFormState(syncEspnTeamsAction, {} as ActionState);
  const [foot, footAction] = useFormState(syncFootballTeamsAction, {} as ActionState);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <form action={espnAction} className="w-64">
          <SubmitButton>Sincronizar Equipes da API ESPN</SubmitButton>
        </form>
        <form action={footAction} className="w-64">
          <SubmitButton>Sincronizar Equipes da API Football</SubmitButton>
        </form>
      </div>
      {espn.error && <p className="text-sm text-red-600">{espn.error}</p>}
      {espn.message && <p className="text-sm text-green-700">{espn.message}</p>}
      {foot.error && <p className="text-sm text-red-600">{foot.error}</p>}
      {foot.message && <p className="text-sm text-green-700">{foot.message}</p>}
    </div>
  );
}
