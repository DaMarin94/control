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
 * Query key: MOVEMENTS_QUERY_KEY(month, categoriesKey, today?)
 *   Varía por mes y por el filtro de categorías serializado. El 4to elemento
 *   opcional (`today`, fecha local YYYY-MM-DD) se agrega SOLO cuando se
 *   provee, para no romper los sitios que invalidan con
 *   MOVEMENTS_QUERY_KEY(month) — ese key de 3 elementos sigue siendo un
 *   prefijo válido de la key real de 4 elementos que usa useMovements
 *   (invalidateQueries matchea por prefijo).
 *   - null → omite el param (= todas).
 *   - ""   → param vacío (= ninguna). Distinto de null en la key.
 *   - string no vacío → subconjunto serializado "id1,id2,...".
 *
 * Se manda `today=YYYY-MM-DD` (fecha local del navegador, NO UTC) para que el
 * backend resuelva "mes en curso" con la fecha del usuario y no con su propio
 * reloj UTC — evita que, cerca de medianoche en zonas UTC-N, el backend crea
 * que ya es el mes siguiente y filtre simulaciones sobre el mes en curso real
 * (RN-028). Mismo mecanismo que use-reports.ts / unique-grid-card.tsx /
 * inflation-income-card.tsx: getters locales de Date (nunca toISOString()).
 *
 * Todas las mutaciones que afectan movimientos deben invalidar
 * la familia ["movements"] por prefijo (no solo un mes concreto).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { MonthMovements } from "@/types/movement";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useMovements");

/**
 * Fecha local del navegador en formato YYYY-MM-DD, para el parámetro `today`
 * de GET /movements. Usa getters locales de Date (NUNCA toISOString(), que
 * devuelve UTC y reintroduce el corrimiento de mes cerca de medianoche en
 * zonas UTC-N). Mismo mecanismo que use-reports.ts (annual-unicos /
 * annual-inflation-income).
 */
function getLocalTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  categoriesKey: string | null = null,
  today?: string
) =>
  today !== undefined
    ? (["movements", month, categoriesKey, today] as const)
    : (["movements", month, categoriesKey] as const);

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
  const today = useMemo(() => getLocalTodayString(), []);

  const query = useQuery<MonthMovements>({
    queryKey: MOVEMENTS_QUERY_KEY(month, categoriesKey, today),
    queryFn: () => {
      const url = `/movements?month=${month}${urlParam}&today=${today}`;
      logger.debug("Cargando movimientos del mes", { month, categoriesKey, today });
      return api.get<MonthMovements>(url);
    },
    // No disparar hasta que la sesión resolvió y el token está presente;
    // evita 401 espurios en el primer render cuando status === "loading".
    enabled: Boolean(month) && isAuthenticated,
  });

  return query;
}
