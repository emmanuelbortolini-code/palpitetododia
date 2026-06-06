import { z } from 'zod';

// commission_rate respeita a constraint do SQL: > 0 e < 100.
export const sportsbookSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  affiliate_url: z.string().url('URL inválida').max(500),
  website_url: z.string().url('URL inválida').max(500).optional().or(z.literal('')),
  logo_url: z.string().url('URL inválida').max(500).optional().or(z.literal('')),
  commission_type: z.enum(['cpa', 'revshare', 'hybrid']),
  commission_rate: z.coerce
    .number()
    .gt(0, 'Deve ser maior que 0')
    .lt(100, 'Deve ser menor que 100'),
  description: z.string().optional(),
});

export type SportsbookInput = z.infer<typeof sportsbookSchema>;
