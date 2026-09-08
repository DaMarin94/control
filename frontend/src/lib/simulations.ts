/**
 * Helpers puros de la Simulación de categoría (docs/design.md "Simulación de
 * categoría (`/mes`)", RF-SIM-001..004, RN-028/029). Copy sensible al conteo
 * (singular/plural con frase propia, nunca "1 movimientos") y el chequeo de
 * horizonte — el resto del copy vive inline en los componentes.
 */

import { formatMonthLabel } from "@/lib/format";

/**
 * `true` si `month` cae dentro del horizonte vigente: el MES EN CURSO
 * INCLUIDO (`>= currentMonth`) hasta `horizonEndMonth` (RN-028). El horizonte
 * arranca en el mes en curso, no en `A+1` — meses pasados siguen sin
 * simularse. Formato `YYYY-MM` en los tres parámetros — la comparación
 * lexicográfica alcanza.
 */
export function isMonthWithinHorizon(
  month: string,
  currentMonth: string,
  horizonEndMonth: string,
): boolean {
  return month >= currentMonth && month <= horizonEndMonth;
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

/** "Se proyecta desde este mes hasta {mes} {año}." — nota de horizonte al pie de la banda (§2). */
export function formatHorizonBandNote(horizonEndMonth: string): string {
  return `Se proyecta desde este mes hasta ${formatMonthLabel(horizonEndMonth)}.`;
}

/** "Alcanza desde este mes hasta {Mes AAAA}." — oración 2 de la bajada del modal "Simular categoría" (§3.1). */
export function formatHorizonReach(horizonEndMonth: string): string {
  return `Alcanza desde este mes hasta ${formatMonthLabel(horizonEndMonth)}.`;
}

/**
 * Rótulo del botón de confirmación del modal "Simular categoría" (§3.5) — el
 * contador vive DENTRO del rótulo. Singular con frase propia (nunca "1
 * categorías"); con 0 seleccionadas el rótulo pierde el número.
 */
export function formatSimulateCta(count: number): string {
  if (count === 0) return "Simular";
  if (count === 1) return "Simular 1 categoría";
  return `Simular ${count} categorías`;
}

/** Toast de éxito TOTAL del batch (§3.7 a). */
export function formatBatchSuccessToast(count: number): string {
  return count === 1 ? "Simulación creada." : `${count} simulaciones creadas.`;
}

/** Toast `warning` del fallo PARCIAL del batch — {K} de {N} (§3.7 c). */
export function formatBatchPartialToast(created: number, total: number): string {
  return created === 1
    ? `Se creó 1 de ${total} simulaciones.`
    : `Se crearon ${created} de ${total} simulaciones.`;
}

/** Copy de la caja de resumen neutra del fallo PARCIAL del batch (§3.7 c). */
export function formatBatchPartialSummary(created: number, total: number): string {
  const lead = created === 1 ? `Se creó 1 de ${total}.` : `Se crearon ${created} de ${total}.`;
  return `${lead} Las que siguen tildadas no se pudieron crear — el motivo está en cada fila.`;
}
