"use client";

/**
 * Hook de datos para el endpoint GET /movements/reports?year=YYYY[&categories=...][&currency=XXX][&types=...][&direction=...].
 *
 * Fase 1.1.5: renombre de use-annual. El endpoint pasó de /movements/annual a
 * /movements/reports y se le agregó el param `categories` para filtrar.
 *
 * Fase 1.1.6: alineación al contrato de 3 estados del backend.
 *
 * Ola 3 (P3): se agrega el param `currency` (CurrencyCode opcional).
 *   - Ausente / undefined → el backend usa la default del usuario (comportamiento actual).
 *   - Presente y válido   → la serie viene convertida a esa moneda.
 *   Se suma a la query key para que React Query refetche al cambiar la moneda.
 *
 * RF-REP-014: se agregan los params `types` y `direction` para la card income-expense.
 *   - `types` ausente / todos → omite el param (= todos los tipos, back-compat).
 *   - `types` subconjunto   → `&types=fijo,cuota` (CSV ordenado, sin URL-encode de comas).
 *   - `types` [] → `&types=` vacío → backend devuelve totales en cero.
 *   - `direction` ausente / "both" → omite el param (back-compat).
 *   - `direction` "expense" | "income" → `&direction=expense` / `&direction=income`.
 *
 * RF-REP-017: se agrega el param `includeSimulated` (opt-in por card, income-expense
 * y by-category). `true` → `&includeSimulated=true`; ausente/false/cualquier otro
 * valor → se omite el param (= off, respuesta idéntica a la de hoy). Se agrega a la
 * query key para que React Query refetche al togglear el chip "Simulados".
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
 * Query key: REPORTS_QUERY_KEY(year, categoriesKey, currency, typesKey, directionKey)
 *   - varía por año, categorías, moneda, tipos y dirección.
 *   - categoriesKey null  → omite el param (= todas).
 *   - categoriesKey ""    → `&categories=` vacío (= ninguna). Distinto de null en la key.
 *   - categoriesKey string no vacío → subconjunto serializado "id1,id2,...".
 *   - currency undefined → param `currency` ausente; null en la key.
 *   - currency "ARS"|"USD"|"EUR"|"BRL" → param `&currency=XXX`; string en la key.
 *   - typesKey null → param `types` ausente (= todos los tipos); null en la key.
 *   - typesKey "" → `&types=` vacío (= ninguno); "" en la key.
 *   - typesKey string no vacío → `&types=fijo,cuota`; CSV en la key.
 *   - directionKey null → param `direction` ausente (= "both"); null en la key.
 *   - directionKey "expense" | "income" → param presente; string en la key.
 *
 * Nota: el backend soporta además `projectFixed`/`today` (RF-REP-015, proyección de
 * fijos a futuro), pero ninguna pantalla los consume hoy — quedan reservados para un
 * futuro módulo de simulación que los consumirá fresco (fuera de este hook).
 *
 * Patrón de autenticación: enabled: isAuthenticated (obligatorio para queries
 * de lectura al montar una pantalla autenticada, igual que useMovements).
 * Sin el guard, durante status === "loading" de Auth.js el token no existe
 * y React Query dispararía la request sin Authorization → 401 espurio.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { ReportsMovementsResponse, UnicoGridResponse, CuotasGanttResponse, AnnualInflationIncomeResponse } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useReports");

// ─── Query key ─────────────────────────────────────────────────────────────────

/**
 * Query key para la serie de reportes de un año, filtro de categorías, moneda, tipos y dirección.
 * Es una FUNCIÓN porque varía por todos esos parámetros.
 *
 * @param year          El año a consultar (ej. 2026).
 * @param categoriesKey null = todas (param ausente); "" = ninguna (param vacío);
 *                      string no vacío = subconjunto "id1,id2,...".
 *   La key DEBE variar entre los 3 estados para que React Query refetche
 *   al pasar de "todas" a "ninguna" o a un subconjunto.
 * @param currency      undefined = default del usuario (param ausente);
 *                      string = código de moneda (param presente). Incluido en la
 *                      key para que React Query refetche al cambiar la moneda.
 * @param typesKey      null = todos los tipos (param ausente, back-compat);
 *                      "" = ningún tipo (param vacío = totales en cero);
 *                      string no vacío = subconjunto CSV "cuota,fijo".
 * @param directionKey  null = "both" (param ausente, back-compat);
 *                      "expense" | "income" = param presente.
 * @param includeSimulated false/undefined = param ausente (= off, back-compat);
 *                      true = `&includeSimulated=true` (RF-REP-017).
 */
export const REPORTS_QUERY_KEY = (
  year: number,
  categoriesKey: string | null,
  currency?: CurrencyCode,
  typesKey?: string | null,
  directionKey?: string | null,
  includeSimulated?: boolean,
) => [
  "reports",
  year,
  categoriesKey,
  currency ?? null,
  typesKey ?? null,
  directionKey ?? null,
  includeSimulated === true,
] as const;

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

// ─── Serialización de tipos de movimiento ─────────────────────────────────────

/**
 * Convierte el estado de movementTypes a la query key y al fragmento de URL.
 * Semántica:
 *   undefined o los 3 tipos → omite el param (back-compat: todos los tipos).
 *   []                      → `&types=` vacío (ninguno; backend devuelve ceros).
 *   subconjunto             → `&types=cuota,fijo` (CSV ordenado).
 */
function serializeMovementTypesFilter(movementTypes?: Array<"fijo" | "cuota" | "unico">): {
  typesKey: string | null;
  typesParam: string;
} {
  if (!movementTypes) {
    return { typesKey: null, typesParam: "" };
  }
  if (movementTypes.length === 0) {
    return { typesKey: "", typesParam: "&types=" };
  }
  // Si están los 3 tipos → equivale a "todos" → omitir param (back-compat)
  if (movementTypes.length === 3) {
    return { typesKey: null, typesParam: "" };
  }
  const sorted = [...movementTypes].sort().join(",");
  return { typesKey: sorted, typesParam: `&types=${sorted}` };
}

// ─── Serialización de dirección ────────────────────────────────────────────────

/**
 * Convierte el estado de direction a la query key y al fragmento de URL.
 * Semántica:
 *   undefined o "both" → omite el param (back-compat: ambas direcciones).
 *   "expense" | "income" → `&direction=expense` / `&direction=income`.
 */
function serializeDirectionFilter(direction?: "expense" | "income" | "both"): {
  directionKey: string | null;
  directionParam: string;
} {
  if (!direction || direction === "both") {
    return { directionKey: null, directionParam: "" };
  }
  return { directionKey: direction, directionParam: `&direction=${direction}` };
}

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook para obtener la serie de reportes agregada (totales + desglose por categoría).
 *
 * @param year          El año a consultar (ej. 2026).
 * @param categoryIds   null = todas; [] = ninguna; lista = subconjunto explícito.
 * @param currency      undefined = default del usuario (sin param); presente = override de moneda por card.
 * @param movementTypes undefined = todos los tipos (back-compat); [] = ninguno; lista = subconjunto.
 * @param direction     undefined / "both" = ambas direcciones (back-compat); "expense" | "income" = filtrar.
 * @param includeSimulated RF-REP-017: undefined/false = off (back-compat, respuesta idéntica a hoy);
 *                      true = suma los movimientos simulados al tramo futuro (`data.simulated`).
 */
export function useReports(
  year: number,
  categoryIds: string[] | null = null,
  currency?: CurrencyCode,
  movementTypes?: Array<"fijo" | "cuota" | "unico">,
  direction?: "expense" | "income" | "both",
  includeSimulated?: boolean,
) {
  const { api, isAuthenticated } = useApi();

  const { categoriesKey, urlParam } = serializeCategoryFilter(categoryIds);
  const { typesKey, typesParam } = serializeMovementTypesFilter(movementTypes);
  const { directionKey, directionParam } = serializeDirectionFilter(direction);

  // Serializar el param de moneda (solo si está presente)
  const currencyParam = currency ? `&currency=${currency}` : "";
  const includeSimulatedParam = includeSimulated ? "&includeSimulated=true" : "";

  const query = useQuery<ReportsMovementsResponse>({
    queryKey: REPORTS_QUERY_KEY(year, categoriesKey, currency, typesKey, directionKey, includeSimulated),
    queryFn: () => {
      // Construir URL manualmente para evitar que URLSearchParams
      // encodee las comas de la lista de categoryIds (RFC 3986: coma es reservada).
      // El backend espera "categories=id1,id2,..." sin encoding.
      // Con [] (ninguna), urlParam = "&categories=" → se manda param vacío explícito.
      // El código de moneda es plano (ARS/USD/EUR/BRL), no necesita encoding.
      const url = `/movements/reports?year=${year}${urlParam}${currencyParam}${typesParam}${directionParam}${includeSimulatedParam}`;
      logger.debug("Cargando serie de reportes", { year, categoriesKey, currency, typesKey, directionKey, includeSimulated });
      return api.get<ReportsMovementsResponse>(url);
    },
    // No disparar hasta que la sesión resolvió y el token está presente.
    // Evita 401 espurios durante el loading inicial de Auth.js.
    enabled: Boolean(year) && isAuthenticated,
    // Al cambiar cualquier filtro, mantiene los datos previos visibles mientras refetcha:
    // isLoading queda false → el skeleton no parpadea en cada toggle.
    // El skeleton solo aparece en la primera carga (sin datos cacheados para esa key).
    placeholderData: keepPreviousData,
  });

  return query;
}

// ─── Hook para la grilla de Únicos (Ola 3, P2) ────────────────────────────────

/**
 * Query key para la grilla anual de Únicos.
 * Varía por año, filtro de categorías, moneda, fecha de hoy y ancla de color.
 */
export const UNICO_GRID_QUERY_KEY = (
  year: number,
  categoriesKey: string | null,
  currency?: CurrencyCode,
  today?: string,
  anchorUsdCents?: number,
) => ["reports-unico-grid", year, categoriesKey, currency ?? null, today ?? null, anchorUsdCents ?? null] as const;

/**
 * Hook para obtener la grilla día×mes de gastos Únicos.
 *
 * GET /movements/reports/annual-unicos?year=YYYY[&categories=...][&currency=XXX][&today=YYYY-MM-DD][&anchorAmountCents=N&anchorCurrency=USD]
 *
 * @param year           El año a consultar.
 * @param categoryIds    null=todas; []=ninguna; lista=subconjunto.
 * @param currency       undefined=default del usuario; presente=override de moneda.
 * @param today          Fecha local del usuario (YYYY-MM-DD). DEBE mandarse para que el
 *                       backend calcule el promedio diario del mes en curso con el divisor
 *                       correcto. Si se omite, el back usa new Date() UTC (subóptimo).
 * @param anchorUsdCents Techo editable de la rampa de color (Ola 3, P3), en centavos de
 *                       USD. undefined = techo estándar (backend usa 15 USD, sin mandar
 *                       params — comportamiento actual). Presente = manda
 *                       `anchorAmountCents=<anchorUsdCents>&anchorCurrency=USD` (el front
 *                       siempre persiste el ancla en USD; la moneda de display del reporte
 *                       es un param independiente — ver `currency`).
 */
export function useUnicoGrid(
  year: number,
  categoryIds: string[] | null = null,
  currency?: CurrencyCode,
  today?: string,
  anchorUsdCents?: number,
) {
  const { api, isAuthenticated } = useApi();

  const { categoriesKey, urlParam } = serializeCategoryFilter(categoryIds);
  const currencyParam = currency ? `&currency=${currency}` : "";
  const todayParam = today ? `&today=${today}` : "";
  const anchorParam =
    anchorUsdCents !== undefined ? `&anchorAmountCents=${anchorUsdCents}&anchorCurrency=USD` : "";

  const query = useQuery<UnicoGridResponse>({
    queryKey: UNICO_GRID_QUERY_KEY(year, categoriesKey, currency, today, anchorUsdCents),
    queryFn: () => {
      const url = `/movements/reports/annual-unicos?year=${year}${urlParam}${currencyParam}${todayParam}${anchorParam}`;
      logger.debug("Cargando grilla de Únicos", { year, categoriesKey, currency, today, anchorUsdCents });
      return api.get<UnicoGridResponse>(url);
    },
    enabled: Boolean(year) && isAuthenticated,
    placeholderData: keepPreviousData,
  });

  return query;
}

// ─── Hook para el gantt de Cuotas (Ola 3, P2) ────────────────────────────────

/**
 * Query key para el gantt anual de Cuotas.
 * Varía por año, filtro de categorías y moneda.
 * Sin parámetro `today` (diferencia con annual-unicos).
 */
export const CUOTAS_GANTT_QUERY_KEY = (
  year: number,
  categoriesKey: string | null,
  currency?: CurrencyCode,
) => ["reports-cuotas-gantt", year, categoriesKey, currency ?? null] as const;

/**
 * Hook para obtener el gantt anual de gastos en Cuotas.
 *
 * GET /movements/reports/annual-cuotas?year=YYYY[&categories=...][&currency=XXX]
 *
 * @param year        El año a consultar.
 * @param categoryIds null=todas; []=ninguna; lista=subconjunto.
 * @param currency    undefined=default del usuario; presente=override de moneda.
 */
export function useCuotasGantt(
  year: number,
  categoryIds: string[] | null = null,
  currency?: CurrencyCode,
) {
  const { api, isAuthenticated } = useApi();

  const { categoriesKey, urlParam } = serializeCategoryFilter(categoryIds);
  const currencyParam = currency ? `&currency=${currency}` : "";

  const query = useQuery<CuotasGanttResponse>({
    queryKey: CUOTAS_GANTT_QUERY_KEY(year, categoriesKey, currency),
    queryFn: () => {
      const url = `/movements/reports/annual-cuotas?year=${year}${urlParam}${currencyParam}`;
      logger.debug("Cargando gantt de Cuotas", { year, categoriesKey, currency });
      return api.get<CuotasGanttResponse>(url);
    },
    enabled: Boolean(year) && isAuthenticated,
    placeholderData: keepPreviousData,
  });

  return query;
}

// ─── Hook para el reporte Inflación vs Ingresos (Ola 4, P5) ──────────────────

/**
 * Query key para el reporte anual de Inflación vs Ingresos.
 * Varía por año, filtro de categorías, moneda y fecha de hoy.
 */
export const INFLATION_INCOME_QUERY_KEY = (
  year: number,
  categoriesKey: string | null,
  currency?: CurrencyCode,
  today?: string,
) => ["reports-inflation-income", year, categoriesKey, currency ?? null, today ?? null] as const;

/**
 * Hook para obtener el reporte anual de Inflación vs Ingresos.
 *
 * GET /movements/reports/annual-inflation-income?year=YYYY[&categories=...][&currency=XXX][&today=YYYY-MM-DD]
 *
 * @param year        El año a consultar.
 * @param categoryIds null=todas; []=ninguna; lista=subconjunto.
 * @param currency    undefined=default del usuario; presente=override de moneda.
 * @param today       Fecha local del usuario (YYYY-MM-DD). Se manda para que el
 *                    backend determine qué meses son futuros en la zona del usuario.
 */
export function useInflationIncome(
  year: number,
  categoryIds: string[] | null = null,
  currency?: CurrencyCode,
  today?: string,
) {
  const { api, isAuthenticated } = useApi();

  const { categoriesKey, urlParam } = serializeCategoryFilter(categoryIds);
  const currencyParam = currency ? `&currency=${currency}` : "";
  const todayParam = today ? `&today=${today}` : "";

  const query = useQuery<AnnualInflationIncomeResponse>({
    queryKey: INFLATION_INCOME_QUERY_KEY(year, categoriesKey, currency, today),
    queryFn: () => {
      const url = `/movements/reports/annual-inflation-income?year=${year}${urlParam}${currencyParam}${todayParam}`;
      logger.debug("Cargando reporte Inflación vs Ingresos", { year, categoriesKey, currency, today });
      return api.get<AnnualInflationIncomeResponse>(url);
    },
    enabled: Boolean(year) && isAuthenticated,
    placeholderData: keepPreviousData,
  });

  return query;
}
