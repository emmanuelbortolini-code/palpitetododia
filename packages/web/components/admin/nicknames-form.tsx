'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/teams';

type Row = { value: string; gender: string };
type TeamNicknames = {
  nicknames_pt: unknown;
  nicknames_en: unknown;
  nicknames_es: unknown;
};

const field = 'rounded border px-3 py-2 dark:bg-gray-900';

// Aceita o formato canônico [{value, gender}] e o legado [string].
function toRows(v: unknown): Row[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) =>
    typeof x === 'string'
      ? { value: x, gender: '' }
      : { value: String((x as Row)?.value ?? ''), gender: String((x as Row)?.gender ?? '') },
  );
}

export function NicknamesForm({
  action,
  defaultValues,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues: TeamNicknames;
}) {
  const [state, formAction] = useFormState(action, {} as ActionState);
  const [pt, setPt] = useState<Row[]>(toRows(defaultValues.nicknames_pt));
  const [en, setEn] = useState<Row[]>(toRows(defaultValues.nicknames_en));
  const [es, setEs] = useState<Row[]>(toRows(defaultValues.nicknames_es));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Section
        title="Português (BR)"
        prefix="pt"
        rows={pt}
        setRows={setPt}
        withGender
      />
      <Section title="English (EN)" prefix="en" rows={en} setRows={setEn} withGender={false} />
      <Section title="Español (ES)" prefix="es" rows={es} setRows={setEs} withGender />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-600">{state.message}</p>}
      <div className="w-48">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}

function Section({
  title,
  prefix,
  rows,
  setRows,
  withGender,
}: {
  title: string;
  prefix: 'pt' | 'en' | 'es';
  rows: Row[];
  setRows: (r: Row[]) => void;
  withGender: boolean;
}) {
  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const add = () => setRows([...rows, { value: '', gender: '' }]);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-gray-500">{`Apelido ${i + 1} (${prefix.toUpperCase()})`}</span>
              <input
                name={`nick_${prefix}_value`}
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                className={field}
              />
            </label>
            {withGender && (
              <label className="flex w-36 flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500">Gênero</span>
                <select
                  name={`nick_${prefix}_gender`}
                  value={r.gender}
                  onChange={(e) => update(i, { gender: e.target.value })}
                  className={field}
                >
                  <option value="">—</option>
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded border px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
      >
        + Adicionar apelido
      </button>
    </div>
  );
}
