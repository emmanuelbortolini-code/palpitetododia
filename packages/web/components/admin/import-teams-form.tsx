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
        <div className="w-40">
          <SubmitButton>Importar CSV</SubmitButton>
        </div>
        <a
          href="/admin/equipes/export"
          className="w-40 rounded bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700"
        >
          Exportar CSV
        </a>
      </div>
      <p className="text-xs text-gray-500">
        Atualiza times existentes pelo ID (mesmo do export). Campos preenchidos viram edição manual.
      </p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
