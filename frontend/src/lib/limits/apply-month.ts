/**
 * Cableado del evaluador de límites en /mes (P2 — Fase 1, Tramo 1).
 *
 * Encapsula la lógica específica de los anclajes por-ítem (`mes.item.monto` y
 * `mes.categoria.gastoMes`) para que `month-view-client.tsx` no tenga que
 * conocer el detalle de refinamiento/combinación — solo llama a
 * `evaluateItemLimitMark` por cada MovementItem renderizado.
 *
 * Los anclajes de nivel-mes (`mes.total.*`, `mes.balance`, `mes.seccion.*`) se
 * evalúan inline en el propio `month-view-client.tsx` (llamadas directas y
 * simples a `evaluateLimits`, sin lógica adicional que amerite un helper acá).
 */

import type { LimitConfig } from "@/types/limit";
import type { MovementItem } from "@/types/movement";
import { evaluateLimits, mergeLimitMarks, type EvaluatedLimitMark } from "@/lib/limits/evaluate";

/**
 * Total gastado por categoría en el mes — dato derivado que alimenta
 * `mes.categoria.gastoMes` (roadmap §2, D2: "se expone aunque no exista como
 * número suelto en pantalla"). Suma `Math.abs(convertedAmountCents)` de los
 * ítems EXPENSE no anulados (mismo criterio de `sumMovementTotals`, RN-019),
 * sobre los movimientos CRUDOS del mes (las 3 secciones, sin filtros de
 * listado — es un total a nivel categoría, no a nivel sección).
 *
 * @returns Map<categoryId, totalCents>
 */
export function computeCategoryExpenseTotalsCents(rawItems: MovementItem[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of rawItems) {
    if (item.skipped) continue;
    if (item.type !== "EXPENSE") continue;
    const current = totals.get(item.category.id) ?? 0;
    totals.set(item.category.id, current + Math.abs(item.convertedAmountCents));
  }
  return totals;
}

/**
 * Evalúa la marca de límite de un MovementItem, combinando `mes.item.monto`
 * (refinamiento por categoría OPCIONAL) y, solo para ítems EXPENSE,
 * `mes.categoria.gastoMes` (refinamiento por categoría REQUERIDO). Devuelve la
 * marca combinada (la más fuerte gana — ver `mergeLimitMarks`) o null si
 * ninguno de los dos anclajes cruza.
 */
export function evaluateItemLimitMark(
  item: MovementItem,
  limits: LimitConfig[],
  categoryExpenseTotalsCents: Map<string, number>,
  isCurrentMonth: boolean,
): EvaluatedLimitMark | null {
  const itemMark = evaluateLimits({
    limits,
    anchorKey: "mes.item.monto",
    value: Math.abs(item.convertedAmountCents) / 100,
    refinement: { categoryId: item.category.id },
    isCurrentMonth,
  });

  // "Gasto de categoría en el mes" solo tiene sentido sobre ítems de gasto.
  const categoryMark =
    item.type === "EXPENSE"
      ? evaluateLimits({
          limits,
          anchorKey: "mes.categoria.gastoMes",
          value: (categoryExpenseTotalsCents.get(item.category.id) ?? 0) / 100,
          refinement: { categoryId: item.category.id },
          isCurrentMonth,
        })
      : null;

  return mergeLimitMarks(itemMark, categoryMark);
}
