"use client";

/**
 * Hook de datos para el endpoint GET /movements/reports?year=YYYY[&categories=...].
 *
 * Fase 1.1.5: renombre de use-annual. El endpoint pasó de /movements/annual a
 * /movements/reports y se le agregó el param `categories` para filtrar.
 *
 * Fase 1.1.6: alineación al contrato de 3 estados del backend.
 *
 * Semántica de `categoryIds` (3 estados):
 *   - null   → param `categories` AUSENTE (= todas).
 *   - []     → param `categories` PRESENTE Y VACÍO (`&categories=`) (= ninguna).
 *   - lista  → `&categories=id1,id2,...` (sin URL-encodear las comas).
 *
 * ATENCIÓN — cambio de comportamiento vs Fase 1.1.5:
 *   Antes, `categoryIds === []` producía `categoriesKey = ""` y omitía el param
 *   (el backend lo interpretaba como "todas"). Ahora `[]` manda `&categories=`
 *   vacío explícito → el backend devuelve resultado vacío / totales en cero.
 *
 * Query key: REPORTS_QUERY_KEY(year, categoriesKey)
 *   - varía por año Y por el string de categorías para que React Query
 *     refetche cuando cambia el filtro de categorías.
 *   - null  → omite el param (= todas).
 *   - ""    → `&categories=` vacío (= ninguna). Distinto de null en la key.
 *   - string no vacío → subconjunto serializado "id1,id2,...".
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
 * @param year          El año a consultar (ej. 2026).
 * @param categoriesKey null = todas (param ausente); "" = ninguna (param vacío);
 *                      string no vacío = subconjunto "id1,id2,...".
 *   La key DEBE variar entre los 3 estados para que React Query refetche
 *   al pasar de "todas" a "ninguna" o a un subconjunto.
 */
export const REPORTS_QUERY_KEY = (
  year: number,
  categoriesKey: string | null
) => ["reports", year, categoriesKey] as const;

// ─── Serialización del filtro ──────────────────────────────────────────────────

/**
 * Convierte el estado de categoryIds a la query key y al fragmento de URL.
 * Retorna { categoriesKey, urlParam }:
 *   - categoriesKey: null | "" | "id1,id2,..."
 *   - urlParam:      cadena a concatenar en la URL (puede ser "")
 */
function serializeCategoryFilter(categoryIds: string[] | null): {
  categoriesKey: string | null;
  urlParam: string;
} {
  if (categoryIds === null) {
    // Todas — omitir el param
    return { categoriesKey: null, urlParam: "" };
  }
  if (categoryIds.length === 0) {
    // Ninguna — param presente y vacío
    return { categoriesKey: "", urlParam: "&categories=" };
  }
  // Subconjunto — lista separada por coma sin URL-encode
  const sorted = [...categoryIds].sort().join(",");
  return { categoriesKey: sorted, urlParam: `&categories=${sorted}` };
}

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook para obtener la serie de reportes agregada (totales + desglose por categoría).
 *
 * @param year        El año a consultar (ej. 2026).
 * @param categoryIds null = todas; [] = ninguna; lista = subconjunto explícito.
 */
export function useReports(year: number, categoryIds: string[] | null = null) {
  const { api, isAuthenticated } = useApi();

  const { categoriesKey, urlParam } = serializeCategoryFilter(categoryIds);

  const query = useQuery<ReportsMovementsResponse>({
    queryKey: REPORTS_QUERY_KEY(year, categoriesKey),
    queryFn: () => {
      // Construir URL manualmente para evitar que URLSearchParams
      // encodee las comas de la lista de categoryIds (RFC 3986: coma es reservada).
      // El backend espera "categories=id1,id2,..." sin encoding.
      // Con [] (ninguna), urlParam = "&categories=" → se manda param vacío explícito.
      const url = `/movements/reports?year=${year}${urlParam}`;
      logger.debug("Cargando serie de reportes", { year, categoriesKey });
      return api.get<ReportsMovementsResponse>(url);
    },
    // No disparar hasta que la sesión resolvió y el token está presente.
    // Evita 401 espurios durante el loading inicial de Auth.js.
    enabled: Boolean(year) && isAuthenticated,
  });

  return query;
}
