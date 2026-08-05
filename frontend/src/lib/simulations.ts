/**
 * Helpers puros de la Simulación de categoría (docs/design.md "Simulación de
 * categoría (`/mes`)", RF-SIM-001..004, RN-028/029). Copy sensible al conteo
 * (singular/plural con frase propia, nunca "1 movimientos") y el chequeo de
 * horizonte — el resto del copy vive inline en los componentes.
 */

import { formatMonthLabel } from "@/lib/format";

/**
 * `true` si `month` es un mes FUTURO (estrictamente posterior a `currentMonth`)
 * y cae dentro del horizonte vigente (`<= horizonEndMonth`, RN-028). Formato
 * `YYYY-MM` en los tres parámetros — la comparación lexicográfica alcanza.
 */
export function isFutureMonthWithinHorizon(
  month: string,
  currentMonth: string,
  horizonEndMonth: string,
): boolean {
  return month > currentMonth && month <= horizonEndMonth;
}

/** "Necesita 3 meses con datos (tiene {N})" — motivo de deshabilitado del selector (§3) y de la simulación pausada (§6.1). */
export function formatMinDataMotive(monthsWithData: number): string {
  return `Necesita 3 meses con datos (tiene ${monthsWithData})`;
}

/** `aria-label`/`title` del glifo de subtotal de Únicos cuando incluye simulados (§5.1). */
export function formatSubtotalSimulatedLabel(count: number): string {
  return count === 1
    ? "El subtotal incluye 1 movimiento simulado"
    : `El subtotal incluye ${count} movimientos simulados`;
}

/** Línea de composición bajo la grilla de totales del mes (§5.2). */
export function formatTotalsSimulatedLine(count: number): string {
  return count === 1
    ? "Los totales incluyen 1 movimiento simulado."
    : `Los totales incluyen ${count} movimientos simulados.`;
}

/** Nota al pie del listado de Únicos por simulaciones pausadas (§6.2). */
export function formatPausedListNote(count: number): string {
  return count === 1
    ? "Una simulación no está proyectando: le faltan meses con datos."
    : `${count} simulaciones no están proyectando: les faltan meses con datos.`;
}

/** "Se proyecta hasta {mes} {año}." — nota de horizonte al pie de la banda (§2). */
export function formatHorizonBandNote(horizonEndMonth: string): string {
  return `Se proyecta hasta ${formatMonthLabel(horizonEndMonth)}.`;
}

/** "Alcanza hasta {Mes AAAA}." — cierre de la bajada del modal "Simular categoría" (§3). */
export function formatHorizonReach(horizonEndMonth: string): string {
  return `Alcanza hasta ${formatMonthLabel(horizonEndMonth)}.`;
}
