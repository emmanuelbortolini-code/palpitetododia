'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionState } from '@/lib/actions/news';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submitLabel: string;
  defaultValues?: {
    title?: string;
    excerpt?: string;
    content?: string;
    cover_image_url?: string | null;
    meta_description?: string | null;
    keywords?: string | null;
  };
};

const inputClass = 'rounded border px-3 py-2 dark:bg-gray-900';

export function ArticleForm({ action, submitLabel, defaultValues }: Props) {
  const [state, formAction] = useFormState(action, {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Título</span>
        <input
          name="title"
          required
          defaultValue={defaultValues?.title}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Resumo</span>
        <textarea
          name="excerpt"
          required
          rows={2}
          defaultValue={defaultValues?.excerpt}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Conteúdo (mín. 100 caracteres)</span>
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

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Meta description (opcional)</span>
        <input
          name="meta_description"
          maxLength={160}
          defaultValue={defaultValues?.meta_description ?? ''}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Keywords (opcional)</span>
        <input
          name="keywords"
          defaultValue={defaultValues?.keywords ?? ''}
          className={inputClass}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
