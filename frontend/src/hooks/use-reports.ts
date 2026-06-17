"use client";

/**
 * Hook de datos para el endpoint GET /movements/reports?year=YYYY[&categories=id1,id2,...].
 *
 * Fase 1.1.5: renombre de use-annual. El endpoint pasó de /movements/annual a
 * /movements/reports y se le agregó el param `categories` para filtrar.
 *
 * Query key: REPORTS_QUERY_KEY(year, categoriesKey)
 *   - varía por año Y por el string de categorías para que React Query
 *     refetche cuando cambia el filtro de categorías.
 *   - categoriesKey: null cuando todas (omite el param), o el string serializado
 *     "id1,id2,..." cuando hay subconjunto explícito.
 *
 * Patrón de autenticación: enabled: isAuthenticated (obligatorio para queries
 * de lectura al montar una pantalla autenticada, igual que useMovements).
 * Sin el guard, durante status === "loading" de Auth.js el token no existe
 * y React Query dispararía la request sin Authorization → 401 espurio.
 */

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { ReportsMovementsResponse } from "@/types/reports";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useReports");

// ─── Query key ─────────────────────────────────────────────────────────────────

/**
 * Query key para la serie de reportes de un año y filtro de categorías.
 * Es una FUNCIÓN porque varía por año y por el filtro de categorías.
 *
 * @param year - El año a consultar (ej. 2026).
 * @param categoriesKey - null = todas; string serializado "id1,id2,..." = subconjunto.
 *   La key DEBE variar por filtro para que React Query refetche al cambiar categorías.
 */
export const REPORTS_QUERY_KEY = (
  year: number,
  categoriesKey: string | null
) => ["reports", year, categoriesKey] as const;

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook para obtener la serie de reportes agregada (totales + desglose por categoría).
 *
 * @param year - El año a consultar (ej. 2026).
 * @param categoryIds - null = todas; lista = subconjunto explícito de categoryIds.
 */
export function useReports(year: number, categoryIds: string[] | null = null) {
  const { api, isAuthenticated } = useApi();

  // Serializar el filtro de categorías para la query key y la URL.
  // null → no se incluye el param (= todas).
  // lista → "id1,id2,..." (sorted para key estable).
  const categoriesKey =
    categoryIds === null ? null : [...categoryIds].sort().join(",");

  const query = useQuery<ReportsMovementsResponse>({
    queryKey: REPORTS_QUERY_KEY(year, categoriesKey),
    queryFn: () => {
      // Construir URL manualmente para evitar que URLSearchParams
      // encodee las comas de la lista de categoryIds (RFC 3986: coma es reservada).
      // El backend espera "categories=id1,id2,..." sin encoding.
      let url = `/movements/reports?year=${year}`;
      if (categoriesKey !== null && categoriesKey !== "") {
        url += `&categories=${categoriesKey}`;
      }
      logger.debug("Cargando serie de reportes", { year, categoriesKey });
      return api.get<ReportsMovementsResponse>(url);
    },
    // No disparar hasta que la sesión resolvió y el token está presente.
    // Evita 401 espurios durante el loading inicial de Auth.js.
    enabled: Boolean(year) && isAuthenticated,
  });

  return query;
}
