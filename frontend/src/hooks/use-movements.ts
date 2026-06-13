"use client";

/**
 * Hook de datos para el endpoint unificado GET /movements?month=YYYY-MM.
 *
 * Reemplaza el useTransactionsByMonth (endpoint /transactions eliminado en Fase 5).
 *
 * Query key: MOVEMENTS_QUERY_KEY(month) = ["movements", month]
 * Donde month tiene formato "YYYY-MM".
 *
 * La query key varía por mes. Las mutaciones de useTransactions invalidan esta
 * clave tras crear/editar/eliminar un movimiento.
 */

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { MonthMovements } from "@/types/movement";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useMovements");

// ─── Query key ─────────────────────────────────────────────────────────────────

/**
 * Query key para los movimientos de un mes.
 * Es una FUNCIÓN porque varía por mes.
 * Todas las mutaciones que afectan movimientos invalidan esta clave.
 */
export const MOVEMENTS_QUERY_KEY = (month: string) =>
  ["movements", month] as const;

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook para obtener todos los movimientos y totales de un mes.
 *
 * @param month - Formato YYYY-MM (ej: "2026-06")
 */
export function useMovements(month: string) {
  const { api, isAuthenticated } = useApi();

  const query = useQuery<MonthMovements>({
    queryKey: MOVEMENTS_QUERY_KEY(month),
    queryFn: () => {
      logger.debug("Cargando movimientos del mes", { month });
      return api.get<MonthMovements>(`/movements?month=${month}`);
    },
    // No disparar hasta que la sesión resolvió y el token está presente;
    // evita 401 espurios en el primer render cuando status === "loading".
    enabled: Boolean(month) && isAuthenticated,
  });

  return query;
}
