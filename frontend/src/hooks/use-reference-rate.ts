"use client";

/**
 * Hook de datos para la cotización de referencia mensual (Fase 1.2.4).
 *
 * GET /settings/reference-rate?month=YYYY-MM&currency=XXX
 * → { currency, defaultCurrency, yearMonth, exchangeRate: number | null }
 *
 * `exchangeRate` = "unidades de la default del usuario por 1 unidad de `currency`".
 * - null: no hay dato en la tabla de referencia para ese mes/moneda.
 * - 1: currency === defaultCurrency (no hay conversión).
 *
 * Reglas:
 * - Query gate-ada con `enabled: isAuthenticated && currency !== defaultCurrency`.
 *   Cuando la moneda del form coincide con la default el bloque muestra
 *   la cotización de la "otra" moneda, pero el pre-fill viene de lastExchangeRate
 *   (que el form ya gestiona), no de este hook.
 * - La query se re-ejecuta si cambia `month` o `currency` (ambos en la query key).
 * - staleTime breve (30 s) — la tabla de referencia no cambia mid-sesión,
 *   pero puede actualizarse con backfill; no queremos cachear indefinidamente.
 */

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { CurrencyCode } from "@/types/settings";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useReferenceRate");

/** Forma del dato que devuelve el endpoint */
export interface ReferenceRateData {
  currency: CurrencyCode;
  defaultCurrency: CurrencyCode;
  yearMonth: string;
  /** Unidades de la default por 1 unidad de currency. null si no hay dato para el mes. */
  exchangeRate: number | null;
}

/**
 * Construye la query key para la cotización de referencia.
 * Varía por mes Y moneda — ambos parámetros afectan la respuesta.
 */
export function referenceRateQueryKey(month: string, currency: CurrencyCode) {
  return ["reference-rate", month, currency] as const;
}

interface UseReferenceRateOptions {
  /** Mes en formato YYYY-MM */
  month: string;
  /** Moneda del movimiento */
  currency: CurrencyCode;
  /** Moneda default del usuario (del hook useSettings) */
  defaultCurrency: CurrencyCode;
}

export function useReferenceRate({ month, currency, defaultCurrency }: UseReferenceRateOptions) {
  const { api, isAuthenticated } = useApi();

  // Solo fetcha cuando hay una conversión real (currency ≠ default).
  // Cuando son iguales, el par label usa la "otra" moneda, pero ese pre-fill
  // lo gestiona el form con lastExchangeRate; no se llama al endpoint.
  const shouldFetch = isAuthenticated && currency !== defaultCurrency;

  const {
    data,
    isLoading,
    isError,
  } = useQuery<ReferenceRateData>({
    queryKey: referenceRateQueryKey(month, currency),
    queryFn: async () => {
      logger.debug("Fetching reference rate", { month, currency });
      return api.get<ReferenceRateData>(
        `/settings/reference-rate?month=${month}&currency=${currency}`,
      );
    },
    enabled: shouldFetch,
    staleTime: 30 * 1000,
  });

  return {
    /** Cotización de referencia del mes. null si no hay dato (usar fallback lastExchangeRate). */
    referenceRate: data?.exchangeRate ?? null,
    isLoading: shouldFetch && isLoading,
    isError,
  };
}
