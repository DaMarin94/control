/**
 * Helpers puros de la Simulación de categoría (docs/design.md "Simulación de
 * categoría (`/mes`)", RF-SIM-001..004, RN-028/029). Copy sensible al conteo
 * (singular/plural con frase propia, nunca "1 movimientos") y el chequeo de
 * pertenencia al tramo — el resto del copy vive inline en los componentes.
 */

import { formatMonthLabel } from "@/lib/format";
import type { SimulationCandidate } from "@/types/simulation";

/**
 * `true` si `month` cae dentro del TRAMO de ESA simulación: desde su arranque
 * EFECTIVO (`effectiveStartMonth`, ya clampeado contra el mes en curso por el
 * backend) hasta su `endMonth`, ambos inclusive. Reemplaza a
 * `isMonthWithinHorizon`: con el ancla por simulación (§0, cambio 1) dejó de
 * existir un horizonte único — la pertenencia se evalúa simulación por
 * simulación, nunca contra un `horizonEndMonth` global. Formato `YYYY-MM` —
 * la comparación lexicográfica alcanza.
 */
export function isMonthWithinSimulationSpan(
  month: string,
  simulation: { effectiveStartMonth: string; endMonth: string },
): boolean {
  return month >= simulation.effectiveStartMonth && month <= simulation.endMonth;
}

/**
 * "Necesita 3 meses con datos (tiene {N})" — motivo de la simulación pausada
 * (§6.1). Ya NO se usa en el selector del modal (§3): las no elegibles se
 * ocultan en vez de mostrarse deshabilitadas con motivo.
 */
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

/**
 * "Cada simulación proyecta desde el mes en que la creaste." — nota general
 * de la banda (§2), constante: con anclas por simulación dejó de haber un
 * tramo único que enunciar; el tramo concreto vive por fila (§4,
 * `formatSimulationSpan`).
 */
export function formatHorizonBandNote(): string {
  return "Cada simulación proyecta desde el mes en que la creaste.";
}

/**
 * "Alcanza desde {Mes inicio} hasta {Mes fin}." — oración 2 de la bajada del
 * modal "Simular categoría" (§3.1). `startMonth`/`endMonth` vienen de
 * `SimulationCandidatesResponse` (ya resueltos por el backend contra el mes
 * visualizado, clampeados a `max(mes visualizado, mes en curso)`).
 */
export function formatHorizonReach(startMonth: string, endMonth: string): string {
  return `Alcanza desde ${formatMonthLabel(startMonth)} hasta ${formatMonthLabel(endMonth)}.`;
}

/**
 * Tramo por fila de la lista de simulaciones activas (§4). `startMonth` es el
 * ancla CRUDA (no la efectiva) de la simulación: si ya es `<= currentMonth`
 * la simulación ya arrancó y alcanza con nombrar el fin; si no, todavía no
 * arrancó y hay que nombrar los dos extremos.
 */
export function formatSimulationSpan(
  startMonth: string,
  endMonth: string,
  currentMonth: string,
): string {
  if (startMonth <= currentMonth) {
    return `Proyecta hasta ${formatMonthLabel(endMonth)}.`;
  }
  return `Proyecta de ${formatMonthLabel(startMonth)} a ${formatMonthLabel(endMonth)}.`;
}

/** Mensaje único de elegibilidad al pie de la lista del selector (§3.1b) — constante. */
export function formatEligibilityNote(): string {
  return "Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando.";
}

/** `true` si la candidata es SIMULABLE (§3): al menos 3 meses con datos y sin simulación activa. */
export function isEligibleCandidate(candidate: SimulationCandidate): boolean {
  return candidate.monthsWithData >= 3 && !candidate.alreadySimulated;
}

/** Causa por la que la lista de elegibles del selector quedó vacía (§3.8). */
export type CandidatesEmptyCause = "no-active-categories" | "no-eligible-data" | "all-simulated" | "mixed";

/**
 * Causa del vacío cuando ninguna candidata del catálogo es simulable (§3.8).
 * `null` si hay al menos una elegible (no corresponde mostrar el empty).
 */
export function getCandidatesEmptyCause(
  categories: SimulationCandidate[],
): CandidatesEmptyCause | null {
  if (categories.some(isEligibleCandidate)) return null;
  if (categories.length === 0) return "no-active-categories";
  const anyWithEnoughData = categories.some((c) => c.monthsWithData >= 3);
  const anyWithoutEnoughData = categories.some((c) => c.monthsWithData < 3);
  if (!anyWithEnoughData) return "no-eligible-data";
  if (!anyWithoutEnoughData) return "all-simulated";
  return "mixed";
}

export interface CandidatesEmptyCopy {
  line1: string;
  line2: string | null;
}

/** Los cuatro copys del vacío del selector, por causa (§3.8) — el frontend no arma ninguno concatenando fragmentos. */
export function formatCandidatesEmpty(cause: CandidatesEmptyCause): CandidatesEmptyCopy {
  switch (cause) {
    case "no-active-categories":
      return { line1: "No tenés categorías activas.", line2: null };
    case "no-eligible-data":
      return {
        line1: "Ninguna categoría llega a 3 meses con datos.",
        line2: "Cuando alguna los acumule, va a aparecer acá.",
      };
    case "all-simulated":
      return {
        line1: "Ya estás simulando todas las categorías que se pueden simular.",
        line2: "Podés verlas y eliminarlas en el filtro de Únicos.",
      };
    case "mixed":
      return {
        line1: "No queda ninguna categoría para simular.",
        line2:
          "Las que tienen 3 o más meses de datos ya las estás simulando; al resto todavía le faltan meses.",
      };
  }
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
