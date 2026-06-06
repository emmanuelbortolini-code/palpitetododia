import { z } from 'zod';

export const academySchema = z.object({
  title: z.string().min(5, 'Mínimo 5 caracteres').max(255, 'Máximo 255 caracteres'),
  content: z.string().min(50, 'Mínimo 50 caracteres'),
  cover_image_url: z.string().url('URL inválida').max(500).optional().or(z.literal('')),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  order_position: z.coerce.number().int().min(0).default(0),
  estimated_read_minutes: z.coerce.number().int().min(1, 'Mínimo 1').default(5),
});

export type AcademyInput = z.infer<typeof academySchema>;
