import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  PORT: z
    .string()
    .optional()
    .default('3001')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
  // GOOGLE_CLIENT_ID es opcional: solo necesario si se usa el endpoint /auth/google.
  // Declarado como opcional para no romper el fail-fast en entornos que no usen Google OAuth.
  GOOGLE_CLIENT_ID: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Valida las variables de entorno al arrancar.
 * Si alguna var falta o es inválida, lanza un error descriptivo y el proceso NO arranca.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(
      `[Config] Variables de entorno inválidas o faltantes:\n${formatted}`,
    );
  }

  return result.data;
}
