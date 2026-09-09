import { addMonths, monthDiff } from '../common/month.helper';

/** Mínimo de meses CON únicos dentro de la ventana para poder simular (RF-SIM-002/RN-028). */
export const MIN_MONTHS_WITH_DATA = 3;

/**
 * Resuelve "A" (mes en curso, RN-028) a partir de un `today` opcional
 * (`YYYY-MM-DD`, fecha local del usuario — mismo contrato que el resto de los
 * endpoints con este param). Ausente → fecha UTC del sistema, mismo criterio
 * que `getReportsMovements` / `getAnnualUnicosReport`.
 */
export function resolveTodayMonthKey(today?: string): string {
  const todayDate = today ? new Date(today + 'T00:00:00Z') : new Date();
  return `${String(todayDate.getUTCFullYear()).padStart(4, '0')}-${String(
    todayDate.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
}

/**
 * Ventana histórica `[A-12 .. A-1]` (RN-028), 12 meses en orden cronológico
 * ascendente. `windowMonths[0]` = A-12 (posición 1 del eje), `windowMonths[11]`
 * = A-1 (posición 12 del eje).
 */
export function buildWindowMonths(todayMonthKey: string): string[] {
  const months: string[] = [];
  for (let i = -12; i <= -1; i++) {
    months.push(addMonths(todayMonthKey, i));
  }
  return months;
}

/**
 * Fin del tramo de UNA simulación (RN-028/RN-029): diciembre del año de
 * `baseMonthKey`, extendido a `baseMonthKey + 6` cuando el tramo posterior a
 * `baseMonthKey` queda por debajo de 6 meses. Devuelve el ÚLTIMO mes del
 * tramo (inclusive), "YYYY-MM".
 *
 * `baseMonthKey` es el `startMonth` (YA CLAMPEADO — nunca un mes pasado) con
 * el que se crea la simulación, NO "hoy": el tramo es propio de cada
 * simulación, ancladas cada una a su propio mes de arranque (antes era un
 * único horizonte igual para todas, anclado siempre a "hoy" — ver
 * `docs/backend.md`, §Simulación de categoría).
 *
 * Ejemplo: baseMonthKey = 2026-07 → tramo `base+1..dic` ([08..12]) = 5 meses
 * (< 6) → extendido a base+6 = 2027-01. baseMonthKey = 2026-06 → tramo
 * `base+1..dic` ([07..12]) = 6 meses (no extiende) → dic = 2026-12.
 */
export function computeHorizonEndMonth(baseMonthKey: string): string {
  const year = baseMonthKey.slice(0, 4);
  const decemberOfYear = `${year}-12`;
  const naturalSpanMonths = monthDiff(baseMonthKey, decemberOfYear);
  return naturalSpanMonths < 6 ? addMonths(baseMonthKey, 6) : decemberOfYear;
}

/**
 * Arranque EFECTIVO de un tramo (RN-028/RN-029): el `startMonth` persistido
 * de una simulación no cambia nunca, pero un tramo que ya arrancó no revive
 * meses pasados. Se reusa tanto al crear (clamp del mes recibido en el
 * request contra el mes en curso) como al leer (clamp del `startMonth`
 * guardado contra el mes en curso VIGENTE en cada lectura, que puede haber
 * avanzado desde que se creó).
 *
 * Comparación lexicográfica: válida porque "YYYY-MM" es zero-padded de largo
 * fijo (mismo criterio que el resto del backend para este formato).
 */
export function effectiveStartMonth(startMonth: string, todayMonthKey: string): string {
  return startMonth > todayMonthKey ? startMonth : todayMonthKey;
}

/**
 * Rango CONTIGUO de meses `[fromMonthKey..toMonthKey]`, en orden cronológico
 * ascendente (inclusive ambos extremos). Usado para materializar la UNIÓN de
 * tramos de `getSimulatedItemsForMonths` en una lista explícita de meses (no
 * solo sus extremos): `loadCategoryMonthlyData` necesita el mes exacto de
 * CADA fila para resolver su cotización de referencia (RF-CUR-005), no solo
 * los bordes del rango.
 */
export function buildMonthRange(fromMonthKey: string, toMonthKey: string): string[] {
  const span = monthDiff(fromMonthKey, toMonthKey);
  const months: string[] = [];
  for (let i = 0; i <= span; i++) {
    months.push(addMonths(fromMonthKey, i));
  }
  return months;
}

/**
 * Posición en el eje de la regresión (RN-028) de un mes dado, relativa a `A`
 * (mes en curso = posición 13; `A+1` = 14; …). La ventana `[A-12..A-1]` ocupa
 * las posiciones `1..12` — no se usa esta función para esos meses, se ajusta
 * la recta directamente sobre `1..12` (ver `fitCategoryRegression`).
 */
export function axisPositionFor(todayMonthKey: string, month: string): number {
  return 13 + monthDiff(todayMonthKey, month);
}
