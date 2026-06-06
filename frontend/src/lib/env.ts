/**
 * Validación de variables de entorno con Zod.
 * Falla en build/start si falta una variable requerida o tiene un formato inválido.
 * Acceso tipado y centralizado: nadie lee process.env directamente fuera de este módulo.
 */
import { z } from "zod";

const envSchema = z.object({
  // --- Backend ---
  NEXT_PUBLIC_API_URL: z.string().url({
    message: "NEXT_PUBLIC_API_URL debe ser una URL válida (ej: http://localhost:4000)",
  }),

  // --- Auth.js ---
  AUTH_SECRET: z.string().min(32, {
    message: "AUTH_SECRET debe tener al menos 32 caracteres",
  }),

  AUTH_BACKEND_JWT_SECRET: z.string().min(16, {
    message: "AUTH_BACKEND_JWT_SECRET debe tener al menos 16 caracteres",
  }),

  // --- Google OAuth ---
  GOOGLE_CLIENT_ID: z.string().min(1, {
    message: "GOOGLE_CLIENT_ID es requerido",
  }),

  GOOGLE_CLIENT_SECRET: z.string().min(1, {
    message: "GOOGLE_CLIENT_SECRET es requerido",
  }),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_BACKEND_JWT_SECRET: process.env.AUTH_BACKEND_JWT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `[ENV] Variables de entorno inválidas o faltantes:\n${errors}\n\n` +
        `Revisá .env.example para ver las variables requeridas.`,
    );
  }

  return result.data;
}

export const env = validateEnv();
