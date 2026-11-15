"use client";

/**
 * Preview de reapertura de un fijo terminado (RF-MF-008) —
 * GET /recurring/:id/reopen-preview?currentMonth=YYYY-MM.
 *
 * Trae lo que el `MovementItem` no tiene: piso del mes de reapertura, último
 * monto, qué reemplazos se exigen (categoría / método dados de baja) y los
 * calculados que se reabren en espejo. Siempre fresco: es una foto puntual
 * para armar un modal, sin caché entre aperturas (`gcTime: 0`).
 */

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { ReopenPreview } from "@/types/recurring";

export function useReopenPreview(id: string, currentMonth: string) {
  const { api, isAuthenticated } = useApi();

  return useQuery<ReopenPreview>({
    queryKey: ["reopen-preview", id, currentMonth],
    queryFn: () => api.get<ReopenPreview>(`/recurring/${id}/reopen-preview?currentMonth=${currentMonth}`),
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
    // Un 400/404 no se arregla reintentando.
    retry: false,
  });
}
