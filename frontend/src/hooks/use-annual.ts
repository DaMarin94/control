"use client";

/**
 * Hook de datos para el endpoint GET /movements/annual?year=YYYY.
 *
 * Query key: ANNUAL_QUERY_KEY(year) = ["annual", year]
 * La key varía por año. No hay mutaciones (solo lectura).
 *
 * Patrón de autenticación: enabled: isAuthenticated (obligatorio para queries
 * de lectura al montar una pantalla autenticada, igual que useMovements).
 * Sin el guard, durante status === "loading" de Auth.js el token no existe
 * y React Query dispararía la request sin Authorization → 401 espurio.
 */

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { AnnualMovementsResponse } from "@/types/annual";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useAnnual");

// ─── Query key ─────────────────────────────────────────────────────────────────

/**
 * Query key para la serie anual de un año.
 * Es una FUNCIÓN porque varía por año.
 */
export const ANNUAL_QUERY_KEY = (year: number) => ["annual", year] as const;

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook para obtener la serie anual agregada (totales + desglose por categoría).
 *
 * @param year - El año a consultar (ej. 2026).
 */
export function useAnnual(year: number) {
  const { api, isAuthenticated } = useApi();

  const query = useQuery<AnnualMovementsResponse>({
    queryKey: ANNUAL_QUERY_KEY(year),
    queryFn: () => {
      logger.debug("Cargando serie anual", { year });
      return api.get<AnnualMovementsResponse>(`/movements/annual?year=${year}`);
    },
    // No disparar hasta que la sesión resolvió y el token está presente.
    // Evita 401 espurios durante el loading inicial de Auth.js.
    enabled: Boolean(year) && isAuthenticated,
  });

  return query;
}
