"use client";

/**
 * Hook de datos para el endpoint unificado GET /movements?month=YYYY-MM[&categories=...].
 *
 * Reemplaza el useTransactionsByMonth (endpoint /transactions eliminado en Fase 5).
 *
 * Fase 1.1.6: se agrega soporte de filtro por categorías.
 *
 * Semántica de `categoryIds` (3 estados):
 *   - null   → param `categories` AUSENTE (= todas). Default.
 *   - []     → param `categories` PRESENTE Y VACÍO (`&categories=`) (= ninguna).
 *   - lista  → `&categories=id1,id2,...` (sin URL-encodear las comas).
 *
 * Query key: MOVEMENTS_QUERY_KEY(month, categoriesKey)
 *   Varía por mes Y por el filtro de categorías serializado.
 *   - null → omite el param (= todas).
 *   - ""   → param vacío (= ninguna). Distinto de null en la key.
 *   - string no vacío → subconjunto serializado "id1,id2,...".
 *
 * Todas las mutaciones que afectan movimientos deben invalidar
 * la familia ["movements"] por prefijo (no solo un mes concreto).
 */

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { MonthMovements } from "@/types/movement";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useMovements");

// ─── Query key ─────────────────────────────────────────────────────────────────

/**
 * Query key para los movimientos de un mes con un filtro de categorías.
 * Es una FUNCIÓN porque varía por mes y por el filtro.
 *
 * @param month         Formato YYYY-MM (ej: "2026-06").
 * @param categoriesKey null = todas (param ausente); "" = ninguna (param vacío);
 *                      string no vacío = subconjunto "id1,id2,...".
 */
export const MOVEMENTS_QUERY_KEY = (
  month: string,
  categoriesKey: string | null = null
) => ["movements", month, categoriesKey] as const;

// ─── Serialización del filtro ──────────────────────────────────────────────────

/**
 * Convierte el estado de categoryIds al fragmento de URL y a la key de caché.
 * Misma lógica que use-reports para consistencia de contrato.
 */
function serializeCategoryFilter(categoryIds: string[] | null): {
  categoriesKey: string | null;
  urlParam: string;
} {
  if (categoryIds === null) {
    return { categoriesKey: null, urlParam: "" };
  }
  if (categoryIds.length === 0) {
    return { categoriesKey: "", urlParam: "&categories=" };
  }
  const sorted = [...categoryIds].sort().join(",");
  return { categoriesKey: sorted, urlParam: `&categories=${sorted}` };
}

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook para obtener todos los movimientos y totales de un mes.
 *
 * @param month       Formato YYYY-MM (ej: "2026-06").
 * @param categoryIds null = todas; [] = ninguna; lista = subconjunto explícito.
 *                    Default: null (todas).
 */
export function useMovements(month: string, categoryIds: string[] | null = null) {
  const { api, isAuthenticated } = useApi();

  const { categoriesKey, urlParam } = serializeCategoryFilter(categoryIds);

  const query = useQuery<MonthMovements>({
    queryKey: MOVEMENTS_QUERY_KEY(month, categoriesKey),
    queryFn: () => {
      const url = `/movements?month=${month}${urlParam}`;
      logger.debug("Cargando movimientos del mes", { month, categoriesKey });
      return api.get<MonthMovements>(url);
    },
    // No disparar hasta que la sesión resolvió y el token está presente;
    // evita 401 espurios en el primer render cuando status === "loading".
    enabled: Boolean(month) && isAuthenticated,
  });

  return query;
}
