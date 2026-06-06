'use client';

import { useFormState } from 'react-dom';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/predictions';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type MatchOption = { id: string; label: string };

type Props = {
  action: Action;
  submitLabel: string;
  matches: MatchOption[];
  defaultValues?: {
    match_id?: string;
    prediction_type?: string;
    prediction_value?: string;
    confidence?: number;
    odds?: number;
    suggested_stake?: number;
    description?: string | null;
    tag_name?: string | null;
  };
};

const inputClass = 'rounded border px-3 py-2 dark:bg-gray-900';

export function PredictionForm({ action, submitLabel, matches, defaultValues }: Props) {
  const [state, formAction] = useFormState(action, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Partida</span>
        <select
          name="match_id"
          required
          defaultValue={defaultValues?.match_id ?? ''}
          className={inputClass}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tipo</span>
          <select
            name="prediction_type"
            defaultValue={defaultValues?.prediction_type ?? 'winner'}
            className={inputClass}
          >
            {Object.entries(PREDICTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Palpite</span>
          <input
            name="prediction_value"
            required
            placeholder="ex: Casa vence"
            defaultValue={defaultValues?.prediction_value}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Odds</span>
          <input
            name="odds"
            type="number"
            step="0.01"
            min="1.01"
            max="999"
            required
            defaultValue={defaultValues?.odds}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Confiança (1–100)</span>
          <input
            name="confidence"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={defaultValues?.confidence ?? 50}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Stake</span>
          <input
            name="suggested_stake"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultValues?.suggested_stake ?? 100}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tag (opcional)</span>
        <input
          name="tag_name"
          defaultValue={defaultValues?.tag_name ?? ''}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Descrição / análise (opcional)</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={defaultValues?.description ?? ''}
          className={inputClass}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
