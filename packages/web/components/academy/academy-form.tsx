'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/academy';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submitLabel: string;
  defaultValues?: {
    title?: string;
    content?: string;
    cover_image_url?: string | null;
    difficulty?: string;
    order_position?: number;
    estimated_read_minutes?: number;
  };
};

const inputClass = 'rounded border px-3 py-2 dark:bg-gray-900';

export function AcademyForm({ action, submitLabel, defaultValues }: Props) {
  const [state, formAction] = useFormState(action, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Título</span>
        <input name="title" required defaultValue={defaultValues?.title} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Conteúdo (mín. 50 caracteres)</span>
        <textarea
          name="content"
          required
          rows={10}
          defaultValue={defaultValues?.content}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">URL da imagem de capa (opcional)</span>
        <input
          name="cover_image_url"
          type="url"
          defaultValue={defaultValues?.cover_image_url ?? ''}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Dificuldade</span>
          <select
            name="difficulty"
            defaultValue={defaultValues?.difficulty ?? 'beginner'}
            className={inputClass}
          >
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Ordem</span>
          <input
            name="order_position"
            type="number"
            min={0}
            defaultValue={defaultValues?.order_position ?? 0}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Min. leitura</span>
          <input
            name="estimated_read_minutes"
            type="number"
            min={1}
            defaultValue={defaultValues?.estimated_read_minutes ?? 5}
            className={inputClass}
          />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
