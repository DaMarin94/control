import { MovementType } from '@prisma/client';
import { addMonths } from './month.helper';

// ---------------------------------------------------------------------------
// Rango de años navegable por card (reportes) — cálculo compartido por los
// 4 endpoints de reportes con stepper de año:
//   GET /movements/reports
//   GET /movements/reports/annual-unicos
//   GET /movements/reports/annual-cuotas
//   GET /movements/reports/annual-inflation-income
//
// Regla de producto: el límite de navegación de año de una card es SU PROPIA
// información — se calcula sobre el dato que esa card grafica, ya filtrado
// (mismo filtro de categorías/tipos/dirección que recibe el endpoint), nunca
// sobre el universo total del usuario (a diferencia de `earliestYear`, que
// es deliberadamente inmune al filtro — ver docs/data-model.md).
// ---------------------------------------------------------------------------

/**
 * Shape de la respuesta: `null` = sin dato navegable (p. ej. filtro que no
 * deja pasar ningún movimiento). Presente = rango continuo [minYear, maxYear]
 * — los años intermedios sin dato propio siguen siendo navegables (no se
 * reporta "hueco por hueco").
 */
export interface YearRange {
  minYear: number;
  maxYear: number;
}

/**
 * Intervalo de años que aporta una fuente de datos individual (un único, una
 * cadena de fijo/calculado, un grupo de cuotas). `endYear: Infinity` marca un
 * fijo activo sin `endMonth` — genera dato indefinidamente hacia adelante
 * (RN-016: con `projectFixed` OFF los meses futuros ya suman fijos por
 * recurrencia). `combineYearIntervals` lo clampea al tope técnico.
 */
export interface YearInterval {
  startYear: number;
  endYear: number;
}

/**
 * Combina los intervalos de todas las fuentes en el rango navegable final de
 * la card, clampeado al tope técnico duro [añoEnCurso-100, añoEnCurso+100]
 * (derivado en runtime a partir de `nowYear`, nunca con años literales).
 *
 * `[]` (sin fuentes que matcheen el filtro) → `null` (RN del punto 7: sin
 * dato → rango ausente).
 */
export function combineYearIntervals(
  intervals: YearInterval[],
  nowYear: number,
): YearRange | null {
  if (intervals.length === 0) return null;

  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const iv of intervals) {
    if (iv.startYear < minYear) minYear = iv.startYear;
    if (iv.endYear > maxYear) maxYear = iv.endYear;
  }

  const floor = nowYear - 100;
  const ceil = nowYear + 100;
  const clampedMin = Math.max(minYear, floor);
  const clampedMax = Math.min(maxYear, ceil);

  // Defensivo: no debería ocurrir (minYear <= maxYear siempre, y el clamp es
  // monótono), pero evita devolver un rango invertido ante datos corruptos.
  if (clampedMin > clampedMax) return null;

  return { minYear: clampedMin, maxYear: clampedMax };
}

/**
 * Recorte ADICIONAL de `maxYear` al año en curso, para cards cuyo dato no
 * existe a futuro: `annual-unicos` (los únicos no se repiten) y
 * `annual-inflation-income` (no hay IPC a futuro). Mismo criterio por el que
 * `fixed-evolution` (RF-REP-013) nunca grafica meses futuros.
 *
 * NO aplica a `GET /movements/reports` ni a `annual-cuotas`: ahí el futuro sí
 * es dato real (fijos por recurrencia, cuotas en tramo) y es navegable.
 *
 * Si el recorte deja `minYear > maxYear` (todo el dato de la card cae en un
 * año futuro), devuelve `null` en vez de un rango invertido — mismo contrato
 * que "sin dato" (el front congela el stepper).
 */
export function clampYearRangeToNow(
  range: YearRange | null,
  nowYear: number,
): YearRange | null {
  if (range === null) return null;
  const maxYear = Math.min(range.maxYear, nowYear);
  if (range.minYear > maxYear) return null;
  return { minYear: range.minYear, maxYear };
}

/**
 * Bucket de tipo de movimiento (fijo/cuota/unico) de una fila `Recurring`,
 * para el filtro `types` de RF-REP-014. El tipo de un CALCULADO se hereda de
 * su fuente (misma regla que el resto de los filtros de tipo/dirección, ver
 * docs/backend.md §Filtros de tipo y dirección) — nunca una categoría propia.
 */
export type RecurringMovementBucket = 'fijo' | 'cuota' | 'unico';

export function recurringMovementBucket(row: {
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
}): RecurringMovementBucket {
  if (row.sourceChainId !== null) return 'fijo';
  if (row.sourceMovementId !== null) return 'unico';
  if (row.sourceInstallmentGroupId !== null) return 'cuota';
  return 'fijo';
}

/**
 * Dirección (EXPENSE/INCOME) de una fila `Recurring` para el cómputo del
 * rango navegable.
 *
 * - Fijo normal: el `type` propio de la fila (exacto).
 * - Calculado: se APROXIMA por el signo de `formulaSign`, no por el signo
 *   real del monto derivado (que requeriría resolver el origen mes a mes,
 *   el mismo costo que la agregación completa — ver docs/backend.md
 *   §Filtros de tipo y dirección → "dirección y tipo de un calculado se
 *   resuelven al vuelo"). Es una aproximación deliberada para este cálculo
 *   de límites de navegación (no de totales): en la inmensa mayoría de los
 *   casos (ADD/MUL/DIV/PCT con operando y origen positivos) el signo nunca
 *   cambia; solo un SUB cuyo operando supera al origen podría cruzar cero
 *   en algún mes puntual, caso borde no cubierto aquí.
 */
export function recurringDirectionBucket(row: {
  type: MovementType;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaSign: number | null;
}): MovementType {
  const isCalculated =
    row.sourceChainId !== null ||
    row.sourceMovementId !== null ||
    row.sourceInstallmentGroupId !== null;
  if (!isCalculated) return row.type;
  return (row.formulaSign ?? 1) > 0 ? MovementType.INCOME : MovementType.EXPENSE;
}

/**
 * Intervalo de años de UNA fila `Recurring` (fijo normal o calculado), por su
 * PROPIA fila — no por cadena. Cada fila cubre un tramo contiguo y no
 * solapado de su cadena (el split al editar cierra la fila vieja con
 * `deletedFrom` = `startMonth` de la fila nueva — ver docs/backend.md
 * §Inmutabilidad del pasado vía "split al editar"), así que no hace falta
 * resolver bordes de cadena para este cálculo: la fila sola ya es el
 * intervalo correcto.
 *
 * `deletedFrom === null` (fijo activo sin fin) → `endYear: Infinity`.
 */
export function recurringRowYearInterval(row: {
  startMonth: string;
  deletedFrom: string | null;
}): YearInterval {
  const startYear = parseInt(row.startMonth.slice(0, 4), 10);
  if (row.deletedFrom === null) return { startYear, endYear: Infinity };
  const lastActiveMonth = addMonths(row.deletedFrom, -1);
  const endYear = parseInt(lastActiveMonth.slice(0, 4), 10);
  return { startYear, endYear };
}

/**
 * Intervalo de años de un grupo de cuotas — siempre acotado (totalInstallments
 * es finito; nunca genera el caso "sin fin" de un fijo).
 */
export function installmentYearInterval(row: {
  startMonth: string;
  totalInstallments: number;
}): YearInterval {
  const startYear = parseInt(row.startMonth.slice(0, 4), 10);
  const lastMonth = addMonths(row.startMonth, row.totalInstallments - 1);
  const endYear = parseInt(lastMonth.slice(0, 4), 10);
  return { startYear, endYear };
}
