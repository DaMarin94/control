"use client";

/**
 * Hook para leer y mutar las preferencias del usuario (Fase 1.1.0).
 *
 * Las preferencias son un blob JSON abierto, extensible sin migraciones de esquema.
 * En esta fase el blob está vacío ({}); las fases consumidoras (1.1.4, 1.1.5, 1.1.6)
 * agregan sus claves con sus propios helpers sobre este hook.
 *
 * Lectura:
 *   - `preferences` refleja el blob actual de la sesión (React Query lo sincroniza al montar).
 *   - `isLoading` es true mientras se carga desde el backend por primera vez.
 *
 * Mutación:
 *   - `setPreferences(newBlob)`: reemplaza el blob entero en el backend (PUT) y actualiza
 *     la sesión de Auth.js sin re-login.
 *   - El frontend es responsable del merge: armar el blob completo antes de llamar.
 *
 * Ejemplo de uso (fases consumidoras):
 *   const { preferences, setPreferences, isSaving } = usePreferences();
 *   // Mutar una clave específica (merge manual):
 *   await setPreferences({ ...preferences, collapsedSections: ["fixed"] });
 *
 * Clave de React Query: PREFERENCES_QUERY_KEY = ["preferences"]
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type { UserPreferences } from "@/types/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("usePreferences");

export const PREFERENCES_QUERY_KEY = ["preferences"] as const;

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export interface SetPreferencesResult {
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePreferences() {
  const { api, isAuthenticated } = useApi();
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();

  // ─── Query: leer preferencias desde el backend ────────────────────────────
  // Iniciamos con el valor de la sesión (cargado al loguear) como dato de inicio.
  // React Query sincroniza en background al montar para reflejar cambios externos.

  const {
    data: preferences,
    isLoading,
    isError,
    error,
  } = useQuery<UserPreferences>({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: () => api.get<UserPreferences>("/preferences"),
    // Inicializar con el blob que ya vino en la sesión (evita flash de undefined).
    // Si la sesión no tiene el campo (sesión antigua antes de Fase 1.1.0), usa {}.
    initialData: session?.preferences ?? {},
    // Marca el initialData como inmediatamente stale (epoch 0) para que React Query
    // dispare el queryFn en background en cuanto `enabled` sea true.
    // Sin esto: al refrescar, la sesión está en "loading" → initialData se siembra con {}
    // y se marca como fresh (staleTime=5min) → cuando la sesión resuelve e isAuthenticated
    // pasa a true, la caché ya está "fresca" → nunca se dispara GET /preferences →
    // reportes vacíos y tema "system" en cada refresh aunque estaban guardados en DB.
    initialDataUpdatedAt: 0,
    // No disparar hasta que la sesión resolvió y el token está presente.
    enabled: isAuthenticated,
    // Las preferencias no se volatizan frecuentemente; cache largo evita refetches innecesarios.
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // ─── Mutation: persistir en el backend + actualizar la sesión ─────────────

  const mutation = useMutation<UserPreferences, ApiError, UserPreferences>({
    mutationFn: (newPreferences) =>
      api.put<UserPreferences>("/preferences", { data: newPreferences }),
    onSuccess: async (persisted) => {
      // 1. Actualizar la caché local de React Query
      queryClient.setQueryData<UserPreferences>(PREFERENCES_QUERY_KEY, persisted);

      // 2. Actualizar el JWT de Auth.js en el cliente para que la sesión refleje
      //    el cambio sin re-login. El callback `jwt` en auth.ts interpreta
      //    trigger === "update" y sobreescribe token.preferences.
      await updateSession({ preferences: persisted });

      logger.info("Preferencias actualizadas en sesión", {
        keys: Object.keys(persisted),
      });
    },
    onError: (err) => {
      logger.error("Error al persistir preferencias", {
        statusCode: err.statusCode,
        message: err.message,
      });
    },
  });

  async function setPreferences(newPreferences: UserPreferences): Promise<SetPreferencesResult> {
    try {
      const persisted = await mutation.mutateAsync(newPreferences);
      return { success: true, preferences: persisted };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          return { success: false, error: "El formato de preferencias no es válido." };
        }
        if (err.statusCode === 401) {
          return { success: false, error: "Sesión expirada. Por favor volvé a iniciar sesión." };
        }
        logger.error("Error al guardar preferencias", { statusCode: err.statusCode });
        return { success: false, error: "No se pudieron guardar las preferencias. Intentalo de nuevo." };
      }
      logger.error("Error inesperado al guardar preferencias", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    /** Blob de preferencias del usuario. Empieza con el valor de la sesión; {} si no hay. */
    preferences: preferences ?? {},
    isLoading,
    isError,
    error,
    /**
     * Persiste el blob COMPLETO en el backend y actualiza la sesión.
     * El llamador es responsable del merge (spread del actual + el cambio).
     *
     * @example
     *   await setPreferences({ ...preferences, collapsedSections: ["fixed"] });
     */
    setPreferences,
    /** true mientras hay una mutación en vuelo */
    isSaving: mutation.isPending,
  };
}
