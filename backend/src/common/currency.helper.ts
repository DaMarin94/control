import { Currency } from '@prisma/client';

// ---------------------------------------------------------------------------
// Semántica del campo exchangeRate por movimiento (Fase 1.2.3 → 1.2.4)
// ---------------------------------------------------------------------------
//
// El campo `exchangeRate` de cada movimiento (Transaction, Recurring,
// InstallmentGroup) representa:
//
//   exchangeRate = unidades de anchorCurrency por 1 unidad de currency
//
// donde `anchorCurrency` es la moneda default del usuario AL MOMENTO de
// guardar el movimiento (campo `anchorCurrency` del mismo registro).
//
// Ejemplos (anchorCurrency = ARS):
//   - movimiento en USD, exchangeRate = 1432 → 1 USD = 1432 ARS
//   - movimiento en EUR, exchangeRate = 1655 → 1 EUR = 1655 ARS
//   - movimiento en BRL, exchangeRate = 280  → 1 BRL = 280  ARS
//   - movimiento en ARS, exchangeRate = 1    → 1 ARS = 1 ARS (sin cambio)
//
// Ejemplos (anchorCurrency = USD):
//   - movimiento en ARS, exchangeRate = 0.000698 → 1 ARS = 0.000698 USD
//   - movimiento en EUR, exchangeRate = 1.155    → 1 EUR = 1.155 USD
//   - movimiento en USD, exchangeRate = 1         → sin cambio
//
// Back-compat (Fase 1.2.3): todos los movimientos existentes tienen
//   anchorCurrency = ARS (default de migración). El exchangeRate guardado
//   era "ARS por 1 currency", que coincide con esta semántica.
//
// ---------------------------------------------------------------------------
// Conversión cuando defaultCurrency (display) ≠ anchorCurrency (del registro)
// ---------------------------------------------------------------------------
//
// Si el usuario cambia su defaultCurrency después de crear el movimiento,
// el exchangeRate guardado ya no aplica directamente. Necesitamos re-rutear
// vía la tabla ReferenceRate del mes del movimiento (pivote USD):
//
//   1. Obtener el monto en anchorCurrency:
//      amount_anchor = amountCents × exchangeRate
//
//   2. Pasar a USD (usando rate_anchor del mes):
//      amount_USD = amount_anchor / rate_anchor
//      (donde rate_anchor = "unidades de anchorCurrency por 1 USD")
//
//   3. Pasar a displayCurrency (usando rate_display del mes):
//      amount_display = amount_USD × rate_display
//
// Simplificado: amount_display = amountCents × exchangeRate × (rate_display / rate_anchor)
//
// Cuando anchorCurrency === displayCurrency: rate_display / rate_anchor = 1
//   → amount_display = amountCents × exchangeRate (igual que antes)
//
// Cuando currency === anchorCurrency: exchangeRate = 1
//   → amount_display = amountCents × rate_display / rate_anchor
//   (conversión directa anchorCurrency → displayCurrency)
//
// Sin filas de ReferenceRate para el mes:
//   Fallback: se usa solo el exchangeRate guardado (como en Fase 1.2.3).
//   Esto es correcto si anchorCurrency === displayCurrency, y es el mejor
//   aproximado disponible cuando no hay datos de referencia.
//
// ---------------------------------------------------------------------------
// Tabla ReferenceRate y el pivote USD
// ---------------------------------------------------------------------------
//
// ReferenceRate almacena: rate = unidades de la moneda por 1 USD (pivote).
//   - ARS: cuántos ARS vale 1 USD (ej: 1432)
//   - EUR: cuántos EUR vale 1 USD (ej: 0.865 → 1 USD = 0.865 EUR)
//   - BRL: cuántos BRL vale 1 USD (ej: 5.11)
//   - USD: no tiene fila (implícito: 1 USD = 1 USD)
//
// El cruce A→B (vía USD):
//   1 unidad de A = (1 / rate_A) USD = (rate_B / rate_A) unidades de B
//
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tipos compartidos
// ---------------------------------------------------------------------------

/**
 * Rates del pivote USD: unidades de cada moneda por 1 USD.
 * USD no tiene entrada (implícito: 1).
 */
export interface PivotRates {
  /** Unidades de ARS por 1 USD */
  ARS: number;
  /** Unidades de BRL por 1 USD */
  BRL: number;
  /** Unidades de EUR por 1 USD */
  EUR: number;
}

// ---------------------------------------------------------------------------
// Función de conversión principal (Fase 1.2.4 — con anchorCurrency)
// ---------------------------------------------------------------------------

/**
 * Convierte un monto en centavos de su moneda original a la moneda de display.
 *
 * Parámetros:
 *   amountCents    — monto en centavos de la moneda original (currency).
 *   currency       — moneda original del movimiento.
 *   exchangeRate   — cotización guardada: unidades de anchorCurrency por 1 unidad de currency.
 *   anchorCurrency — moneda default del usuario AL MOMENTO DE GUARDAR el movimiento.
 *   displayCurrency — moneda default vigente del usuario (a la que se convierte para display).
 *   pivotRates     — cotizaciones de referencia del mes del movimiento (de ReferenceRate).
 *                    Si es null/vacío, se usa fallback con el exchangeRate guardado.
 *
 * Lógica:
 *   1. Si currency === displayCurrency → sin conversión.
 *   2. Si anchorCurrency === displayCurrency → usa exchangeRate guardado directamente.
 *   3. Si hay pivotRates → re-rutea: amount_display = amountCents × exchangeRate × (rate_display / rate_anchor).
 *   4. Sin pivotRates (fallback) → usa exchangeRate directamente (como Fase 1.2.3).
 *
 * El resultado se redondea a centavos enteros (Math.round).
 *
 * @returns Monto convertido en centavos enteros de displayCurrency.
 */
export function convertToDisplayCurrency(
  amountCents: number,
  currency: Currency,
  exchangeRate: number,
  anchorCurrency: Currency,
  displayCurrency: Currency,
  pivotRates: Partial<PivotRates> | null,
): number {
  // Sin conversión: ya está en la moneda de display
  if (currency === displayCurrency) {
    return amountCents;
  }

  // Guard defensivo
  if (exchangeRate === 0) return 0;

  // Caso simple: la moneda de display coincide con el anchor del movimiento
  // → el exchangeRate guardado ya expresa el cruce currency → displayCurrency
  if (anchorCurrency === displayCurrency) {
    return Math.round(amountCents * exchangeRate);
  }

  // Re-ruteo vía pivote USD usando las cotizaciones de referencia del mes
  if (pivotRates) {
    const rateOf = (c: Currency): number | null => {
      if (c === Currency.USD) return 1; // pivote implícito
      const r = pivotRates[c as keyof PivotRates];
      return r != null ? r : null;
    };

    const rateAnchor = rateOf(anchorCurrency);
    const rateDisplay = rateOf(displayCurrency);

    if (rateAnchor !== null && rateAnchor !== 0 && rateDisplay !== null) {
      // Si currency === anchorCurrency, el monto ya está en el anchor (exchangeRate es irrelevante).
      // Si no, hay que convertir primero a anchor multiplicando por exchangeRate.
      const valueInAnchor =
        currency === anchorCurrency ? amountCents : amountCents * exchangeRate;
      return Math.round(valueInAnchor * (rateDisplay / rateAnchor));
    }
  }

  // Fallback defensivo: sin datos de referencia para el mes.
  //
  // IMPORTANTE: este fallback es un degradado de último recurso. Con el clamp
  // de resolveNearestYearMonth aplicado en los callers, casi nunca debería
  // ejecutarse. Cuando sí lo hace (tabla vacía o moneda no disponible):
  //
  //   - Si currency === anchorCurrency: el monto ya está en el anchor (exchangeRate
  //     es irrelevante o basura). Devolver amountCents sin multiplicar evita valores
  //     absurdos (ej: ARS con exchangeRate=1450 basura visto en USD sin rates).
  //     NOTA: el resultado no es correcto en displayCurrency, pero nunca infla.
  //
  //   - Si currency ≠ anchorCurrency: el exchangeRate sí es significativo
  //     (amount → anchor). Comportamiento idéntico a Fase 1.2.3.
  //     Correcto si anchorCurrency === displayCurrency; aproximado en otro caso.
  //
  // Nunca debe producir valores fuera de escala.
  if (currency === anchorCurrency) {
    return amountCents;
  }
  return Math.round(amountCents * exchangeRate);
}

// ---------------------------------------------------------------------------
// Conversión por-mes para fijos y cuotas (Ola 1 / P3)
// ---------------------------------------------------------------------------

/**
 * Convierte un monto de fijo/cuota a displayCurrency usando SOLO los pivotRates
 * del mes de la instancia. Ignora el exchangeRate/anchorCurrency guardados en la
 * fila porque esos corresponden al momento de la carga, no al mes que se está
 * mostrando.
 *
 * Diseño:
 *   Fijos y cuotas pueden vivir durante meses/años; su `exchangeRate` queda
 *   congelado al valor del día en que el usuario los creó. Usar ese valor para
 *   cada instancia mensual produciría siempre el mismo importe en display,
 *   ignorando la evolución real del TC. La solución es derivar la cotización
 *   al vuelo desde la tabla ReferenceRate (variante oficial) del mes de la
 *   instancia, que el sync actualiza mensualmente.
 *
 *   La fórmula es:
 *     amount_display = amountCents × deriveExchangeRate(currency, displayCurrency, pivotRates)
 *   donde deriveExchangeRate reutea por el pivote USD igual que el resto del sistema.
 *
 * Casos directos:
 *   currency === displayCurrency → sin conversión (devuelve amountCents tal cual).
 *
 * Fallback (tabla vacía o rate faltante para la moneda):
 *   Degradado de último recurso al comportamiento anterior: convierte con el
 *   exchangeRate/anchorCurrency guardados. Con el clamp de resolveNearestYearMonth
 *   aplicado por el caller, esto casi nunca ocurre. Cuando sí ocurre garantiza
 *   que no produce valores fuera de escala (nunca infla), igual que convertToDisplayCurrency.
 *   NOTA: el fallback usa los valores guardados del movimiento, no del mes.
 *
 * @param amountCents      Monto en centavos de la moneda original.
 * @param currency         Moneda original del fijo/cuota.
 * @param displayCurrency  Moneda de display del usuario.
 * @param pivotRates       Cotizaciones de referencia del mes de la instancia.
 *                         Si null (tabla vacía), se aplica el fallback.
 * @param fallbackExchangeRate  Cotización guardada en la fila (usado SOLO en fallback).
 * @param fallbackAnchorCurrency Anchor guardado en la fila (usado SOLO en fallback).
 * @returns Monto convertido en centavos enteros de displayCurrency.
 */
export function convertToDisplayCurrencyByMonth(
  amountCents: number,
  currency: Currency,
  displayCurrency: Currency,
  pivotRates: Partial<PivotRates> | null,
  fallbackExchangeRate: number,
  fallbackAnchorCurrency: Currency,
): number {
  // Sin conversión: ya está en la moneda de display
  if (currency === displayCurrency) {
    return amountCents;
  }

  // Caso normal: derivar la cotización del mes desde los pivotRates
  if (pivotRates) {
    const derived = deriveExchangeRate(currency, displayCurrency, pivotRates);
    if (derived !== null) {
      return Math.round(amountCents * derived);
    }
    // pivotRates presente pero falta alguna moneda necesaria → caer al fallback
  }

  // Fallback de último recurso: sin datos de referencia para el mes.
  //
  // IMPORTANTE: este path es un degradado. Con el clamp de resolveNearestYearMonth
  // casi nunca se ejecuta. Cuando lo hace (tabla vacía o moneda faltante), delega
  // a convertToDisplayCurrency con los valores guardados, que garantiza no inflar
  // (en particular, currency === anchorCurrency → devuelve amountCents).
  return convertToDisplayCurrency(
    amountCents,
    currency,
    fallbackExchangeRate,
    fallbackAnchorCurrency,
    displayCurrency,
    null, // sin pivotRates ya confirmado que son nulos/insuficientes
  );
}

/**
 * @deprecated Usar convertToDisplayCurrency con anchorCurrency.
 * Mantenida por compatibilidad con código que no necesita re-ruteo
 * (cuando la default no cambió respecto del momento de creación).
 *
 * ATENCIÓN: esta función asume que anchorCurrency === defaultCurrency.
 * Si el usuario cambió su defaultCurrency, produce resultados incorrectos.
 * Solo usar cuando se sabe que anchorCurrency === displayCurrency (ej: ambas son ARS).
 */
export function convertToDefaultCurrency(
  amountCents: number,
  currency: Currency,
  exchangeRate: number,
  defaultCurrency: Currency,
): number {
  if (currency === defaultCurrency) {
    return amountCents;
  }
  if (exchangeRate === 0) return 0;
  return Math.round(amountCents * exchangeRate);
}

// ---------------------------------------------------------------------------
// Resolución de yearMonth con clamp al rango disponible
// ---------------------------------------------------------------------------

/**
 * Resuelve el yearMonth más cercano disponible en la tabla ReferenceRate.
 *
 * La tabla ReferenceRate tiene un rango finito (ej: 2025-01..2026-06).
 * Cuando se pide un mes fuera de ese rango, se usa el extremo más cercano:
 *   - Mes POSTERIOR al máximo disponible → usa el máximo.
 *   - Mes ANTERIOR al mínimo disponible → usa el mínimo.
 *   - Mes en hueco intermedio → el más cercano (distancia en meses).
 *   - Mes exactamente disponible → lo devuelve tal cual.
 *   - Lista vacía → devuelve null (tabla sin datos).
 *
 * Complejidad: O(N log N) una vez al ordenar; luego O(N) para buscar.
 * Con N=18 (seed actual) es irrelevante.
 *
 * @param yearMonth  Mes pedido en formato YYYY-MM.
 * @param available  Array de todos los yearMonths con filas en ReferenceRate.
 * @returns El yearMonth resuelto (puede ser diferente al pedido), o null si la lista está vacía.
 */
export function resolveNearestYearMonth(
  yearMonth: string,
  available: string[],
): string | null {
  if (available.length === 0) return null;

  // Si ya está disponible, respuesta directa sin ordenar
  if (available.includes(yearMonth)) return yearMonth;

  const sorted = [...available].sort();
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Clamping por extremos (casos más comunes: futuro o pasado lejano)
  if (yearMonth <= min) return min;
  if (yearMonth >= max) return max;

  // Hueco intermedio (no debería ocurrir con el seed actual, pero es robusto)
  // Buscar el más cercano por distancia en meses
  let best = sorted[0];
  let bestDist = Math.abs(monthDistanceForClamp(yearMonth, sorted[0]));
  for (let i = 1; i < sorted.length; i++) {
    const dist = Math.abs(monthDistanceForClamp(yearMonth, sorted[i]));
    if (dist < bestDist) {
      bestDist = dist;
      best = sorted[i];
    }
  }
  return best;
}

/**
 * Distancia en meses entre dos yearMonths YYYY-MM (b - a, puede ser negativa).
 * Solo para uso interno de resolveNearestYearMonth.
 */
function monthDistanceForClamp(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// ---------------------------------------------------------------------------
// Derivación del exchangeRate desde la tabla ReferenceRate (pivote USD)
// ---------------------------------------------------------------------------

/**
 * Deriva el exchangeRate por movimiento desde las cotizaciones de pivote USD.
 *
 * El resultado = "unidades de anchorCurrency por 1 unidad de currency".
 * Es el valor que debe guardarse en exchangeRate del movimiento.
 *
 * Fórmula (pasando por el pivote USD):
 *   rate_pivot(moneda) = "unidades de esa moneda por 1 USD"
 *   rate_pivot(USD) = 1 (por definición)
 *
 *   exchangeRate = rate_pivot(anchorCurrency) / rate_pivot(currency)
 *
 * Ejemplos (anchorCurrency=ARS):
 *   currency=USD:  ARS_rate / USD_rate = 1432 / 1 = 1432
 *   currency=EUR:  ARS_rate / EUR_rate = 1432 / 0.865 ≈ 1656
 *   currency==anchorCurrency: 1 (sin cambio)
 *
 * @param currency        Moneda del movimiento.
 * @param anchorCurrency  Moneda default del usuario (a guardar como anchorCurrency).
 * @param pivotRates      Cotizaciones de referencia del mes (de la tabla ReferenceRate).
 *                        Si no hay cotización para el mes, usar null para devolver null.
 * @returns exchangeRate derivado (número positivo), o null si no hay datos.
 */
export function deriveExchangeRate(
  currency: Currency,
  anchorCurrency: Currency,
  pivotRates: Partial<PivotRates> | null,
): number | null {
  if (currency === anchorCurrency) {
    return 1;
  }

  if (!pivotRates) return null;

  const rateOf = (c: Currency): number | null => {
    if (c === Currency.USD) return 1; // pivote implícito
    const r = pivotRates[c as keyof PivotRates];
    return r != null ? r : null;
  };

  const rateCurrency = rateOf(currency);
  const rateAnchor = rateOf(anchorCurrency);

  if (rateCurrency === null || rateAnchor === null) return null;
  if (rateCurrency === 0) return null; // guard defensivo

  return rateAnchor / rateCurrency;
}

/**
 * Extrae las PivotRates de las filas crudas de ReferenceRate del repositorio.
 *
 * @param rows Filas de ReferenceRate para un yearMonth dado.
 * @returns PivotRates parciales (solo las monedas presentes en las filas).
 */
export function buildPivotRates(
  rows: Array<{ currency: Currency; rate: number }>,
): Partial<PivotRates> {
  const result: Partial<PivotRates> = {};
  for (const row of rows) {
    if (row.currency === Currency.ARS) result.ARS = row.rate;
    else if (row.currency === Currency.BRL) result.BRL = row.rate;
    else if (row.currency === Currency.EUR) result.EUR = row.rate;
    // USD no tiene fila (rate=1 implícito)
  }
  return result;
}
