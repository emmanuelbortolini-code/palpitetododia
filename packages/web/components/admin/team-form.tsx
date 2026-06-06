'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/teams';

type Country = { id: string; name: string };

type TeamValues = {
  name: string;
  name_en: string | null;
  name_es: string | null;
  country_id: string | null;
  founded: number | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_capacity: number | null;
  website: string | null;
  gender: string | null;
  nicknames_pt: string[] | null;
  nicknames_en: string[] | null;
  nicknames_es: string[] | null;
};

const field = 'rounded border px-3 py-2 dark:bg-gray-900';
const list = (v: string[] | null) => (v ?? []).join(', ');

export function TeamForm({
  action,
  countries,
  defaultValues,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  countries: Country[];
  defaultValues: TeamValues;
}) {
  const [state, formAction] = useFormState(action, {} as ActionState);
  const v = defaultValues;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nome (PT)
          <input name="name" required defaultValue={v.name} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nome (EN)
          <input name="name_en" defaultValue={v.name_en ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nome (ES)
          <input name="name_es" defaultValue={v.name_es ?? ''} className={field} />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          País
          <select name="country_id" defaultValue={v.country_id ?? ''} className={field}>
            <option value="" disabled>
              Selecione
            </option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ano de fundação
          <input name="founded" type="number" defaultValue={v.founded ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gênero
          <input name="gender" defaultValue={v.gender ?? ''} className={field} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Estádio
        <input name="venue_name" defaultValue={v.venue_name ?? ''} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Endereço do estádio
        <input name="venue_address" defaultValue={v.venue_address ?? ''} className={field} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Cidade
          <input name="venue_city" defaultValue={v.venue_city ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Capacidade
          <input
            name="venue_capacity"
            type="number"
            defaultValue={v.venue_capacity ?? ''}
            className={field}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Site oficial
        <input name="website" type="url" placeholder="https://..." defaultValue={v.website ?? ''} className={field} />
      </label>

      <p className="text-xs text-gray-500">Apelidos separados por vírgula.</p>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Apelidos (PT)
          <input name="nicknames_pt" defaultValue={list(v.nicknames_pt)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Apelidos (EN)
          <input name="nicknames_en" defaultValue={list(v.nicknames_en)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Apelidos (ES)
          <input name="nicknames_es" defaultValue={list(v.nicknames_es)} className={field} />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="w-48">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}
