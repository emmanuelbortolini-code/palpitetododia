'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/sportsbooks';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submitLabel: string;
  defaultValues?: {
    name?: string;
    affiliate_url?: string;
    website_url?: string | null;
    logo_url?: string | null;
    commission_type?: string;
    commission_rate?: number;
    description?: string | null;
  };
};

const inputClass = 'rounded border px-3 py-2 dark:bg-gray-900';

export function SportsbookForm({ action, submitLabel, defaultValues }: Props) {
  const [state, formAction] = useFormState(action, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nome</span>
        <input name="name" required defaultValue={defaultValues?.name} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">URL de afiliado</span>
        <input
          name="affiliate_url"
          type="url"
          required
          defaultValue={defaultValues?.affiliate_url}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Site (opcional)</span>
        <input
          name="website_url"
          type="url"
          defaultValue={defaultValues?.website_url ?? ''}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">URL do logo (opcional)</span>
        <input
          name="logo_url"
          type="url"
          defaultValue={defaultValues?.logo_url ?? ''}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tipo de comissão</span>
          <select
            name="commission_type"
            defaultValue={defaultValues?.commission_type ?? 'cpa'}
            className={inputClass}
          >
            <option value="cpa">CPA</option>
            <option value="revshare">RevShare</option>
            <option value="hybrid">Híbrido</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Taxa de comissão (%)</span>
          <input
            name="commission_rate"
            type="number"
            step="0.01"
            min="0.01"
            max="99.99"
            required
            defaultValue={defaultValues?.commission_rate}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Descrição (opcional)</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ''}
          className={inputClass}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
