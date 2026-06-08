"use client";

/**
 * Hook que encapsula la lógica de registro de usuario.
 *
 * Flujo:
 * 1. Llama a POST /auth/register con email + password.
 * 2. Si 409 (email en uso): devuelve el error sin perder el email (RF-AUTH-006).
 * 3. Si OK: inicia sesión automáticamente con signIn("credentials") y
 *    redirige al dashboard sin pasar por /login (RF-AUTH-006 criterio).
 * 4. Errores de servidor: toast de error + permite reintentar.
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import { createLogger } from "@/lib/logger";
import type { AuthResponse, RegisterRequest } from "@/types/auth";

const logger = createLogger("useRegister");

export interface RegisterResult {
  success: boolean;
  emailInUse?: boolean;
  error?: string;
}

export function useRegister() {
  const [isLoading, setIsLoading] = useState(false);

  async function register(
    data: RegisterRequest & { redirectTo?: string },
  ): Promise<RegisterResult> {
    setIsLoading(true);

    try {
      // 1. Llamar al backend para crear el usuario
      await api.post<AuthResponse>("/auth/register", {
        email: data.email,
        password: data.password,
      });

      // 2. Iniciar sesión automáticamente (RF-AUTH-006: redirigir sin pasar por /login)
      // redirect: true hace que Next.js navegue directamente — no hay valor de retorno.
      const callbackUrl = data.redirectTo ?? "/dashboard";

      await signIn("credentials", {
        email: data.email,
        password: data.password,
        callbackUrl,
        redirect: true,
      });

      // Este punto solo se alcanza si signIn falló silenciosamente (muy raro)
      logger.warn("signIn automático post-registro no navegó como esperado");
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        // 409: email ya registrado
        if (err.statusCode === 409) {
          return { success: false, emailInUse: true };
        }

        // 400: error de validación del backend
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }

        // 5xx o de red
        logger.error("Error en registro", { statusCode: err.statusCode });
        return { success: false, error: "Ocurrió un error al registrarte. Intentalo de nuevo." };
      }

      logger.error("Error inesperado en registro", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    } finally {
      setIsLoading(false);
    }
  }

  return { register, isLoading };
}
