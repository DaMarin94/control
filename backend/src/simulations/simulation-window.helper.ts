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
 * Horizonte de la simulación (RN-028): de `A+1` a diciembre del año en curso,
 * extendido a `A+6` cuando ese tramo queda por debajo de 6 meses (el tramo
 * simulado NUNCA es menor a 6 meses). Devuelve el ÚLTIMO mes del horizonte
 * (inclusive), "YYYY-MM".
 *
 * Ejemplo: A = 2026-07 → tramo natural [08..12] = 5 meses (< 6) → extendido a
 * A+6 = 2027-01 (horizonte ago..ene, 6 meses). A = 2026-06 → tramo natural
 * [07..12] = 6 meses (no extiende) → horizonte jul..dic.
 */
export function computeHorizonEndMonth(todayMonthKey: string): string {
  const year = todayMonthKey.slice(0, 4);
  const decemberOfYear = `${year}-12`;
  const naturalSpanMonths = monthDiff(todayMonthKey, decemberOfYear);
  return naturalSpanMonths < 6 ? addMonths(todayMonthKey, 6) : decemberOfYear;
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
