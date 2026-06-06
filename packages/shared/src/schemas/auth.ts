import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e _'),
  full_name: z.string().max(100).optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const resetRequestSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
