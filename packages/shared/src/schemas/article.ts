import { z } from 'zod';

// Espelha as constraints do schema SQL (title 10-255, content >= 100).
// O slug é gerado no servidor a partir do título, não é input do usuário.
export const articleSchema = z.object({
  title: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(255, 'Máximo 255 caracteres'),
  excerpt: z.string().min(1, 'Resumo obrigatório'),
  content: z.string().min(100, 'Mínimo 100 caracteres'),
  cover_image_url: z
    .string()
    .url('URL inválida')
    .max(500)
    .optional()
    .or(z.literal('')),
  meta_description: z.string().max(160, 'Máximo 160 caracteres').optional(),
  keywords: z.string().max(255).optional(),
});

export type ArticleInput = z.infer<typeof articleSchema>;
