/**
 * Evaluador client-side de Límites y Alertas — Fase 1 (marca visual pasiva).
 *
 * Función pura, sin dependencias de React/DOM: dado el array de límites del
 * usuario y un valor emitido en un anclaje, devuelve la marca que corresponde
 * aplicar (o null si ningún límite cruza). Read-path puro (roadmap-limites-
 * alertas.md §4): se evalúa sobre datos que el front ya tiene renderizados.
 *
 * Regla de colisión (docs/design.md, "Colisión de marcas — un dato, varios
 * límites"): se renderiza UNA sola marca por dato — la más fuerte entre las que
 * cruzan (orden quiet→fuerte: bold, tint, glyph, dot, badge, fill, ring) — y el
 * texto accesible enumera TODOS los límites cruzados, no solo el ganador.
 */

import type { LimitConfig, LimitEffect, LimitOperator, LimitRefinement } from "@/types/limit";
import { deriveLimitLabel, getAnchorDef } from "@/lib/limits/catalog";

/** Orden de fuerza de los 7 efectos — más alto = más fuerte, gana la colisión. */
const EFFECT_STRENGTH: Record<LimitEffect, number> = {
  bold: 1,
  tint: 2,
  glyph: 3,
  dot: 4,
  badge: 5,
  fill: 6,
  ring: 7,
};

function compare(operator: LimitOperator, value: number, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Un límite SIN refinamiento aplica a cualquier instancia emitida (universal).
 * Un límite CON refinamiento solo aplica si coincide con el refinamiento del
 * dato emitido (ej. limita a la sección "unicos", o a una categoría puntual).
 */
function refinementMatches(
  limitRefinement: LimitRefinement | undefined,
  emittedRefinement: LimitRefinement | undefined,
): boolean {
  if (!limitRefinement) return true;
  if (limitRefinement.section !== undefined) {
    return limitRefinement.section === emittedRefinement?.section;
  }
  if (limitRefinement.categoryId !== undefined) {
    return limitRefinement.categoryId === emittedRefinement?.categoryId;
  }
  return true;
}

function resolveEffect(limit: LimitConfig): LimitEffect {
  return limit.effect ?? getAnchorDef(limit.anchorKey)?.defaultEffect ?? "glyph";
}

export interface EvaluateLimitsInput {
  /** Array completo de límites del usuario (preferences.limits ?? []). */
  limits: LimitConfig[];
  /** Key del catálogo que este dato emite (ej. "mes.total.gasto"). */
  anchorKey: string;
  /** Valor numérico del dato, en la unidad del `unit` de la key (número puro, sin moneda). */
  value: number;
  /** Refinamiento del dato emitido (sección / categoría), si corresponde. */
  refinement?: LimitRefinement;
  /**
   * true si el mes en contexto (el que se está renderizando) es el mes real en
   * curso — gobierna `temporalScope: "current"`. Se pasa como booleano ya resuelto
   * por el llamador (no se calcula "ahora" acá — evaluador puro, sin Date()).
   */
  isCurrentMonth: boolean;
}

export interface EvaluatedLimitMark {
  /** Efecto ganador de la colisión — el que hay que renderizar. */
  effect: LimitEffect;
  /** TODOS los límites que cruzaron (para el texto accesible — enumera todos). */
  matched: LimitConfig[];
}

/**
 * Evalúa los límites contra un valor emitido y devuelve la marca a aplicar.
 * Devuelve null si `limits` está vacío o ningún límite habilitado/pasivo cruza
 * — esto es lo que garantiza el "cero impacto" con config vacía (D9).
 */
export function evaluateLimits(input: EvaluateLimitsInput): EvaluatedLimitMark | null {
  const { limits, anchorKey, value, refinement, isCurrentMonth } = input;

  const matched = limits.filter((limit) => {
    if (!limit.enabled) return false;
    // Fase 1: el evaluador de marca pasiva solo consume límites "passive".
    // Los "active" (Fase 2, alerta al guardar) se evalúan en el write-path, no acá.
    if (limit.nature !== "passive") return false;
    if (limit.anchorKey !== anchorKey) return false;
    if (limit.temporalScope === "current" && !isCurrentMonth) return false;
    if (!refinementMatches(limit.refinement, refinement)) return false;
    return compare(limit.operator, value, limit.threshold);
  });

  if (matched.length === 0) return null;

  let strongest = matched[0]!;
  let strongestScore = EFFECT_STRENGTH[resolveEffect(strongest)];
  for (const limit of matched) {
    const score = EFFECT_STRENGTH[resolveEffect(limit)];
    if (score > strongestScore) {
      strongest = limit;
      strongestScore = score;
    }
  }

  return { effect: resolveEffect(strongest), matched };
}

/**
 * Evaluador write-path de la naturaleza ACTIVA (P2 — Fase 2, `lib/limits/project.ts`).
 * Filtra por `enabled` + `nature === "active"` + `anchorKey` + refinamiento, y
 * compara `dato {operator} threshold` — MISMA comparación/refinamiento que
 * `evaluateLimits` (reuso de `compare`/`refinementMatches`). `temporalScope` se
 * IGNORA (D20: no aplica a la activa, siempre proyecta sobre el mes destino).
 *
 * Devuelve TODOS los límites activos que cruzan (D18 — el aviso enumera todos).
 */
export function matchActiveLimits(
  limits: LimitConfig[],
  anchorKey: string,
  value: number,
  refinement?: LimitRefinement,
): LimitConfig[] {
  return limits.filter((limit) => {
    if (!limit.enabled) return false;
    if (limit.nature !== "active") return false;
    if (limit.anchorKey !== anchorKey) return false;
    if (!refinementMatches(limit.refinement, refinement)) return false;
    return compare(limit.operator, value, limit.threshold);
  });
}

/**
 * Combina dos marcas evaluadas sobre EL MISMO dato renderizado (ej. un ítem de
 * /mes que emite tanto `mes.item.monto` como `mes.categoria.gastoMes`) en una
 * sola marca — mismo criterio de colisión (la más fuerte gana, el texto
 * accesible enumera todos los límites cruzados de ambas).
 */
export function mergeLimitMarks(
  a: EvaluatedLimitMark | null,
  b: EvaluatedLimitMark | null,
): EvaluatedLimitMark | null {
  if (!a) return b;
  if (!b) return a;
  const effect = EFFECT_STRENGTH[a.effect] >= EFFECT_STRENGTH[b.effect] ? a.effect : b.effect;
  return { effect, matched: [...a.matched, ...b.matched] };
}

export interface DescribeLimitMarkContext {
  /**
   * Nombre de la categoría del ítem que emite la marca — requerido para
   * enunciar el texto a11y de `mes.categoria.gastoMes` a nivel categoría-mes
   * (ver caso especial abajo). Ausente en anclajes que no son por-ítem.
   */
  categoryName?: string;
}

/**
 * Texto accesible que enumera los límites cruzados (a11y — "nunca solo color",
 * docs/design.md). Reusa el `label` del límite o su placeholder derivado.
 * Ej.: "Supera el límite: Gasto del mes > 300.000".
 *
 * Caso especial `mes.categoria.gastoMes`: es una key derivada que se repite en
 * CADA fila de la categoría (roadmap §2, D2) — el texto NO puede describir el
 * monto de la fila individual, debe enunciar el cruce a nivel categoría-mes
 * ("Gasto del mes en {categoría} supera el límite"). Si el límite tiene `label`
 * propio, se respeta ese label (mismo formato que el resto de las keys).
 */
export function describeLimitMark(mark: EvaluatedLimitMark, context?: DescribeLimitMarkContext): string {
  const descriptions = mark.matched.map((limit) => {
    if (limit.anchorKey === "mes.categoria.gastoMes") {
      if (limit.label) return `Supera el límite: ${limit.label}`;
      const categoryName = context?.categoryName ?? "la categoría";
      return `Gasto del mes en ${categoryName} supera el límite`;
    }
    const label = limit.label ?? deriveLimitLabel(limit.anchorKey, limit.operator, limit.threshold);
    return `Supera el límite: ${label}`;
  });
  return Array.from(new Set(descriptions)).join(" · ");
}
