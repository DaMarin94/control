"use client";

/**
 * Mutación de reapertura de un fijo terminado (RF-MF-008) —
 * POST /recurring/:id/reopen. Hook propio (no suma a `useRecurring`) para no
 * ensanchar su contrato: solo lo consume `RecurringReopenModal`.
 *
 * Invalidaciones: las mismas que una edición de fijo — el mes (`["movements"]`),
 * el historial y los reportes. Las keys de reportes (incluida la vista evolución)
 * son `reports`, `reports-unico-grid`, `reports-fixed-evolution`, etc.: no cuelgan
 * de un único prefijo, por eso el predicado sobre el primer segmento.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import { isReportsQuery } from "@/lib/reports-query";
import { createLogger } from "@/lib/logger";
import type { ReopenRecurringRequest, ReopenRecurringResponse } from "@/types/recurring";

const logger = createLogger("useReopenRecurring");

export interface ReopenRecurringResult {
  success: boolean;
  /** Id de la entrada de historial creada — habilita el "Deshacer" del toast. */
  historyEntryId?: string;
  error?: string;
}

export function useReopenRecurring() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation<ReopenRecurringResponse, ApiError, { id: string; data: ReopenRecurringRequest }>({
    mutationFn: ({ id, data }) => api.post<ReopenRecurringResponse>(`/recurring/${id}/reopen`, data),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
      void queryClient.invalidateQueries({ predicate: isReportsQuery });
      logger.info("Fijo reabierto", { reopenMonth: res.reopenMonth, skippedCount: res.skippedCount });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al reabrir fijo", { statusCode: err.statusCode });
      }
    },
  });

  async function reopenRecurring(id: string, data: ReopenRecurringRequest): Promise<ReopenRecurringResult> {
    try {
      const res = await mutation.mutateAsync({ id, data });
      return { success: true, historyEntryId: res.historyEntryId };
    } catch (err) {
      if (err instanceof ApiError) {
        logger.error("Error al reabrir fijo", { statusCode: err.statusCode });
      } else {
        logger.error("Error inesperado al reabrir fijo", {
          error: err instanceof Error ? err.message : "desconocido",
        });
      }
      return { success: false, error: "No se pudo reabrir el movimiento." };
    }
  }

  return { reopenRecurring, isReopening: mutation.isPending };
}
