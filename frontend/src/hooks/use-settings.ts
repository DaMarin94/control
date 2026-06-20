"use client";

/**
 * Hook de datos para la configuración del usuario (Fase 1.2.3).
 *
 * GET /settings  → { defaultCurrency, lastExchangeRate }
 * PATCH /settings → actualiza en vivo; invalida queries de movimientos y reportes.
 *
 * Reglas:
 * - Query gate-ada con `enabled: isAuthenticated` (mismo patrón que todos los hooks de lectura).
 * - Al cambiar defaultCurrency, se invalidan las queries de ["movements"] y ["reports"]
 *   por prefijo — el monto convertido (convertedAmountCents) cambia para todos los ítems.
 * - Persistencia optimista: el cambio se refleja de inmediato en la caché local;
 *   si el PATCH falla, React Query deja el estado anterior (no se hace rollback manual).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type { UserSettings, UpdateSettingsRequest } from "@/types/settings";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useSettings");

export const SETTINGS_QUERY_KEY = ["settings"] as const;

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export interface UpdateSettingsResult {
  success: boolean;
  settings?: UserSettings;
  error?: string;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useSettings() {
  const { api, isAuthenticated } = useApi();
  const queryClient = useQueryClient();

  // ─── Query: cargar configuración ──────────────────────────────────────────

  const {
    data: settings,
    isLoading,
    isError,
  } = useQuery<UserSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => api.get<UserSettings>("/settings"),
    enabled: isAuthenticated,
    // Las settings no cambian frecuentemente; 5 min es suficiente.
    staleTime: 5 * 60 * 1000,
  });

  // ─── Mutation: actualizar configuración ───────────────────────────────────

  const mutation = useMutation<UserSettings, ApiError, UpdateSettingsRequest>({
    mutationFn: (data) => api.patch<UserSettings>("/settings", data),
    onSuccess: (updated) => {
      // Actualizar la caché de settings
      queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, updated);

      // Invalidar movimientos y reportes por prefijo — convertedAmountCents cambia
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });

      logger.info("Settings actualizadas", {
        defaultCurrency: updated.defaultCurrency,
      });
    },
    onError: (err) => {
      logger.error("Error al actualizar settings", {
        statusCode: err.statusCode,
        message: err.message,
      });
    },
  });

  async function updateSettings(
    data: UpdateSettingsRequest,
  ): Promise<UpdateSettingsResult> {
    try {
      const updated = await mutation.mutateAsync(data);
      return { success: true, settings: updated };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al guardar settings", { statusCode: err.statusCode });
        return {
          success: false,
          error: "No se pudo guardar la configuración. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al guardar settings", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    /** Configuración del usuario. undefined mientras carga. */
    settings,
    /** defaultCurrency con fallback "ARS" (back-compat — nunca undefined en el runtime) */
    defaultCurrency: settings?.defaultCurrency ?? "ARS",
    /** Último tipo de cambio usado, null si nunca se usó */
    lastExchangeRate: settings?.lastExchangeRate ?? null,
    isLoading,
    isError,
    updateSettings,
    /** true mientras hay una mutación en vuelo */
    isSaving: mutation.isPending,
  };
}
