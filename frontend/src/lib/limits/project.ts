/**
 * Motor de proyección — Límites y Alertas, naturaleza ACTIVA (P2 — Fase 2).
 *
 * Función pura, sin dependencias de React/DOM: dado el movimiento que se está
 * por guardar (crear o editar) y los agregados CRUDOS del mes destino (sin
 * filtros de listado — la misma fuente que ya alimenta `/mes`), devuelve la
 * lista de límites ACTIVOS que se cruzarían al persistirlo. Write-path puro
 * (docs/roadmap-limites-alertas.md §4/§6, D13–D19).
 *
 * Reusa la comparación operador/umbral de `lib/limits/evaluate.ts`
 * (`matchActiveLimits`, que ya filtra `enabled` + `nature === "active"` +
 * `anchorKey` + refinamiento e IGNORA `temporalScope`, D20).
 *
 * Reglas cubiertas:
 * - D13 (mes de proyección): lo decide el LLAMADOR pasando `monthRaw` del mes
 *   correcto (único → su propio mes; fijo/cuota → el mes en curso real). Este
 *   motor solo proyecta sobre el mes que se le pasa.
 * - D14 (qué anclajes mueve cada movimiento): un EXPENSE proyecta
 *   `mes.total.gasto` / `mes.balance` / `mes.seccion.subtotal`+`conteo` de su
 *   sección / `mes.categoria.gastoMes` de su categoría. Un INCOME proyecta
 *   SOLO `mes.total.ingreso` / `mes.balance` (el subtotal/conteo de sección y
 *   el gasto por categoría son EXCLUSIVOS de gasto, tal cual cierra D14 — un
 *   ingreso no los "toca"). `mes.item.monto` es la excepción universal (D19):
 *   no es un acumulador, es un chequeo directo del monto de ESTE movimiento,
 *   así que se evalúa para cualquier tipo.
 * - D15 (edición reemplaza): `editingId` excluye la contribución PREVIA del
 *   movimiento de los agregados antes de sumar la nueva.
 * - D16 (anulado no proyecta): `skipped: true` → devuelve `[]` directo.
 * - D17 (moneda): el LLAMADOR ya convirtió el monto al canónico antes de
 *   invocar este motor (`toCanonicalAmountCents`); acá todo es número puro.
 * - D18 (cruces múltiples): se devuelven TODOS los límites activos cruzados
 *   (deduplicados por id — un mismo límite no se repite si cruza por más de
 *   un anclaje, caso border no esperado pero cubierto).
 * - D19 (keys especiales): `mes.item.monto` chequea el monto de ESTE
 *   movimiento sin acumular; `mes.seccion.conteo` proyecta conteo actual + 1.
 */

import type { LimitConfig, LimitRefinement } from "@/types/limit";
import type { MovementItem, MovementsByOrigin } from "@/types/movement";
import type { CurrencyCode } from "@/types/settings";
import { matchActiveLimits } from "@/lib/limits/evaluate";
import { sumMovementTotals, groupSubtotalCents } from "@/lib/movements";
import { computeCategoryExpenseTotalsCents } from "@/lib/limits/apply-month";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Sección de /mes a la que pertenece el movimiento — mapeo directo del tab de carga. */
export type ProjectionSection = "unicos" | "fijos" | "cuotas";

/** Agregados crudos del mes destino — MISMO shape que `MonthMovements.movements` (GET /movements). */
export type MonthRawMovements = MovementsByOrigin;

export interface ProjectedMovement {
  type: "EXPENSE" | "INCOME";
  /**
   * Monto YA convertido a la moneda canónica (default del usuario), en
   * centavos, MAGNITUD positiva (D17). Ver `toCanonicalAmountCents`.
   */
  convertedAmountCents: number;
  categoryId: string;
  /** Sección de /mes a la que pertenece este movimiento. */
  section: ProjectionSection;
  /**
   * true si el movimiento se guarda/edita YA anulado (D16) — no proyecta nada.
   * Los 3 forms de carga no exponen el toggle de anular; en edición refleja el
   * `skipped` VIGENTE del ítem (que la edición no cambia). En creación siempre `false`.
   */
  skipped: boolean;
  /**
   * Id del movimiento en edición — se excluye su contribución PREVIA de los
   * agregados antes de sumar la nueva (D15: reemplaza, no suma). `undefined`
   * en creación.
   */
  editingId?: string;
}

// ─── D17 — conversión a moneda canónica ───────────────────────────────────────

/**
 * Convierte un monto a la moneda canónica (default del usuario) ANTES de
 * comparar contra el umbral (D17, coherente con D3 — el umbral es número puro).
 * Misma fórmula que usa el backend para `convertedAmountCents` (data-model.md):
 * `amountCents` si `currency === defaultCurrency`; si no, `amountCents * exchangeRate`
 * redondeado (unidades de la default por 1 unidad de `currency`).
 */
export function toCanonicalAmountCents(
  amountCents: number,
  currency: CurrencyCode,
  defaultCurrency: CurrencyCode,
  exchangeRate: number,
): number {
  if (currency === defaultCurrency) return amountCents;
  return Math.round(amountCents * exchangeRate);
}

// ─── Helpers internos ──────────────────────────────────────────────────────────

function excludeEditing(items: MovementItem[], editingId: string | undefined): MovementItem[] {
  if (!editingId) return items;
  return items.filter((item) => item.id !== editingId);
}

// ─── Motor principal ────────────────────────────────────────────────────────────

/**
 * Proyecta el movimiento sobre los agregados del mes destino y devuelve los
 * límites ACTIVOS que se cruzarían al guardar. `[]` si no hay cruces —
 * incluye los casos: movimiento anulado (D16), sin límites activos habilitados,
 * o simplemente ningún cruce real.
 */
export function projectActiveLimitCrossings(
  movement: ProjectedMovement,
  monthRaw: MonthRawMovements,
  limits: LimitConfig[],
): LimitConfig[] {
  // D16: un movimiento que se guarda/edita YA anulado no proyecta.
  if (movement.skipped) return [];

  // Cero fricción (espejo write-path de D9): sin límites activos habilitados,
  // ni construir agregados.
  const hasAnyActive = limits.some((limit) => limit.enabled && limit.nature === "active");
  if (!hasAnyActive) return [];

  // D15: excluir la contribución PREVIA del movimiento en edición (reemplaza, no suma).
  const unicos = excludeEditing(monthRaw.unicos, movement.editingId);
  const fijos = excludeEditing(monthRaw.fijos, movement.editingId);
  const cuotas = excludeEditing(monthRaw.cuotas, movement.editingId);
  const allRaw = [...unicos, ...fijos, ...cuotas];

  const sectionItems: Record<ProjectionSection, MovementItem[]> = { unicos, fijos, cuotas };
  const targetSectionItems = sectionItems[movement.section];

  const crossed = new Map<string, LimitConfig>();
  function collect(anchorKey: string, value: number, refinement?: LimitRefinement) {
    for (const limit of matchActiveLimits(limits, anchorKey, value, refinement)) {
      crossed.set(limit.id, limit);
    }
  }

  // ── mes.total.gasto / mes.total.ingreso / mes.balance (D14) ──
  // sumMovementTotals ya excluye ítems `skipped` (RN-019) — magnitudes en centavos.
  const baseTotals = sumMovementTotals(allRaw);
  const projectedExpenseCents =
    baseTotals.expense + (movement.type === "EXPENSE" ? movement.convertedAmountCents : 0);
  const projectedIncomeCents =
    baseTotals.income + (movement.type === "INCOME" ? movement.convertedAmountCents : 0);
  const projectedBalanceCents = projectedIncomeCents - projectedExpenseCents;

  if (movement.type === "EXPENSE") {
    collect("mes.total.gasto", projectedExpenseCents / 100);
  } else {
    collect("mes.total.ingreso", projectedIncomeCents / 100);
  }
  collect("mes.balance", projectedBalanceCents / 100);

  // ── mes.seccion.subtotal / mes.seccion.conteo / mes.categoria.gastoMes ──
  // D14 (cierre literal): SOLO un gasto proyecta estos tres anclajes; un
  // ingreso no los "toca" (a diferencia de mes.item.monto, universal — ver abajo).
  if (movement.type === "EXPENSE") {
    // Subtotal neto de la sección: income+ − expense−. Sumar un gasto lo reduce.
    const baseSectionSubtotalCents = groupSubtotalCents(targetSectionItems);
    const projectedSectionSubtotalCents = baseSectionSubtotalCents - movement.convertedAmountCents;
    collect("mes.seccion.subtotal", projectedSectionSubtotalCents / 100, { section: movement.section });

    // D19: conteo proyectado = conteo actual (crudo, incluye ítems anulados — mismo
    // criterio que la marca pasiva) + 1 (este movimiento).
    const projectedSectionCount = targetSectionItems.length + 1;
    collect("mes.seccion.conteo", projectedSectionCount, { section: movement.section });

    // Gasto por categoría en el mes — dato derivado (D2), sobre TODAS las secciones.
    const categoryTotals = computeCategoryExpenseTotalsCents(allRaw);
    const baseCategoryCents = categoryTotals.get(movement.categoryId) ?? 0;
    const projectedCategoryCents = baseCategoryCents + movement.convertedAmountCents;
    collect("mes.categoria.gastoMes", projectedCategoryCents / 100, { categoryId: movement.categoryId });
  }

  // ── mes.item.monto — chequeo directo, sin acumular (D19); universal (cualquier tipo) ──
  collect("mes.item.monto", movement.convertedAmountCents / 100, { categoryId: movement.categoryId });

  return Array.from(crossed.values());
}
