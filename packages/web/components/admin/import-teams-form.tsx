'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { importTeamsCsvAction, type ActionState } from '@/lib/actions/teams';

export function ImportTeamsForm() {
  const [state, formAction] = useFormState(importTeamsCsvAction, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Arquivo CSV
          <input type="file" name="file" accept=".csv" required className="text-sm" />
        </label>
        <label className="flex flex-col text-sm">
          Liga
          <input
            name="league_name"
            defaultValue="Brasileirão Série A"
            className="rounded border px-2 py-1 dark:bg-gray-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          Temporada
          <input
            name="season"
            type="number"
            defaultValue={2026}
            className="w-24 rounded border px-2 py-1 dark:bg-gray-900"
          />
        </label>
        <div className="w-40">
          <SubmitButton>Importar CSV</SubmitButton>
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
