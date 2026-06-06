'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import { syncTeamsAction, type ActionState } from '@/lib/actions/refdata';

type League = { id: string; name: string };

export function SyncTeamsForm({
  leagues,
  defaultSeason,
}: {
  leagues: League[];
  defaultSeason: number;
}) {
  const [state, formAction] = useFormState(syncTeamsAction, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {!leagues.length ? (
        <p className="text-sm text-gray-500">
          Sincronize as ligas primeiro (aba Ligas) para escolher uma aqui.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-sm">
            Liga
            <select name="league_id" className="rounded border px-2 py-1 dark:bg-gray-900">
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Temporada
            <input
              name="season"
              type="number"
              defaultValue={defaultSeason}
              min={2022}
              max={2024}
              className="w-24 rounded border px-2 py-1 dark:bg-gray-900"
            />
          </label>
          <div className="w-48">
            <SubmitButton>Sincronizar times</SubmitButton>
          </div>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
