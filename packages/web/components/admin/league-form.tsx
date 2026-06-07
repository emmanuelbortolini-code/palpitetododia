'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/refdata';

type Country = { id: string; name: string };

type LeagueValues = {
  name: string;
  name_en: string | null;
  name_es: string | null;
  slug: string;
  slug_en: string | null;
  slug_es: string | null;
  country_id: string | null;
  logo_url: string | null;
  gender_en: string | null;
  gender_br: string | null;
  gender_es: string | null;
  nicknames_pt: string[] | null;
  nicknames_en: string[] | null;
  nicknames_es: string[] | null;
};

const field = 'rounded border px-3 py-2 dark:bg-gray-900';
const list = (v: string[] | null) => (v ?? []).join(', ');

export function LeagueForm({
  action,
  countries,
  defaultValues,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  countries: Country[];
  defaultValues: LeagueValues;
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
          Slug (PT)
          <input name="slug" required defaultValue={v.slug} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Slug (EN)
          <input name="slug_en" defaultValue={v.slug_en ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Slug (ES)
          <input name="slug_es" defaultValue={v.slug_es ?? ''} className={field} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          Logo (URL)
          <input name="logo_url" type="url" placeholder="https://..." defaultValue={v.logo_url ?? ''} className={field} />
        </label>
      </div>

      <p className="text-xs text-gray-500">Gênero (ex.: male / female).</p>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Gênero (EN)
          <input name="gender_en" defaultValue={v.gender_en ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gênero (BR)
          <input name="gender_br" defaultValue={v.gender_br ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gênero (ES)
          <input name="gender_es" defaultValue={v.gender_es ?? ''} className={field} />
        </label>
      </div>

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
