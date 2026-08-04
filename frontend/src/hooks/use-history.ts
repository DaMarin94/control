"use client";

/**
 * Hook de datos para el Historial de cambios — GET /history, POST /history/:id/undo.
 * Wrapper fino sobre React Query + useApi (patrón establecido, docs/technical.md
 * §Convenciones de hooks).
 *
 * Deshacer MUTA datos de movimientos (RF-HIST-003): además de invalidar la lista
 * de historial, invalida por prefijo `["movements"]` y `["reports"]` — la vista
 * del mes, el dashboard y los reportes dependen de esos datos y deben refrescarse
 * solos (mismo patrón que `useSettings` al cambiar la moneda default).
 *
 * Un solo endpoint (`POST /history/:id/undo`) cubre tanto el deshacer simple
 * como el deshacer en cadena (el backend decide y deshace todo lo necesario
 * atómicamente) — nunca se llama en loop desde el frontend.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type { HistoryEntryResponseDto, UndoHistoryResponse } from "@/types/history";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useHistory");

export const HISTORY_QUERY_KEY = ["history"] as const;

export interface UndoHistoryResult {
  success: boolean;
  error?: string;
}

/** Lista de entradas de historial del usuario (RF-HIST-002). */
export function useHistory() {
  const { api, isAuthenticated } = useApi();

  const query = useQuery<HistoryEntryResponseDto[]>({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: () => api.get<HistoryEntryResponseDto[]>("/history"),
    enabled: isAuthenticated,
  });

  return query;
}

/** Deshacer una entrada (simple o en cadena — mismo endpoint, RF-HIST-003/004). */
export function useUndoHistory() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation<UndoHistoryResponse, ApiError, { id: string }>({
    mutationFn: ({ id }) => api.post<UndoHistoryResponse>(`/history/${id}/undo`, undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      logger.info("Entrada de historial deshecha");
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al deshacer entrada de historial", {
          statusCode: err.statusCode,
        });
      }
    },
  });

  async function undo(id: string): Promise<UndoHistoryResult> {
    try {
      await mutation.mutateAsync({ id });
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "Este cambio ya no está disponible para deshacer." };
        }
        logger.error("Error al deshacer entrada de historial", { statusCode: err.statusCode });
        return { success: false, error: "No se pudo deshacer el cambio. Intentá de nuevo." };
      }
      logger.error("Error inesperado al deshacer entrada de historial", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "No se pudo deshacer el cambio. Intentá de nuevo." };
    }
  }

  return { undo, isUndoing: mutation.isPending };
}
