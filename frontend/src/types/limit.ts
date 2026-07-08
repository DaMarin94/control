/**
 * Tipos del sistema de Límites y Alertas (P2 — docs/roadmap-limites-alertas.md).
 *
 * Fase 1: marca visual pasiva, todo el catálogo. Fase 2: alerta ACTIVA
 * (aviso no bloqueante al guardar un movimiento) sobre las 7 keys `mes.*`.
 * El blob `limits` es frontend-puro / opaco para el backend, igual que
 * `theme` / `reports` / `monthSections` (evaluación 100% client-side, D4 semilla).
 *
 * Shape del límite: docs/roadmap-limites-alertas.md §1.
 * Catálogo de keys hardcodeadas: §2 (implementado en lib/limits/catalog.ts).
 * Catálogo de efectos visuales: docs/design.md §"Marca visual pasiva de límites".
 * Aviso de la naturaleza activa: docs/design.md §"Aviso de alerta activa de límites".
 */

/** Comparación `dato {operator} threshold` (D1 — condición única, sin compuestos). */
export type LimitOperator = "gt" | "gte" | "lt" | "lte" | "eq";

/**
 * A qué meses aplica el límite (D4). Solo relevante para `nature: "passive"`
 * (D20 — la activa no usa `temporalScope`, ver `LimitConfig.temporalScope`).
 * "all"     = cualquier mes navegable que cruce (default).
 * "current" = solo el mes en curso (el mes real de "hoy", no el mes navegado).
 */
export type LimitTemporalScope = "all" | "current";

/**
 * Naturaleza del disparo.
 * "passive" = marca visual al renderizar (Fase 1).
 * "active"  = aviso no bloqueante al intentar guardar un movimiento (Fase 2).
 */
export type LimitNature = "passive" | "active";

/**
 * Identificador de efecto visual — catálogo CERRADO de 7 primitivas definido por
 * control-design (docs/design.md §"Marca visual pasiva de límites" → Vocabulario
 * de efectos). Orden de quiet → fuerte: bold, tint, glyph, dot, badge, fill, ring.
 */
export type LimitEffect = "bold" | "tint" | "glyph" | "dot" | "badge" | "fill" | "ring";

/** Sección de /mes — para refinar keys `mes.seccion.*`. */
export type LimitSectionRefinement = "unicos" | "fijos" | "cuotas";

/**
 * Acota una key cuando emite muchas instancias (roadmap §1, "keys con refinamiento").
 * `section` para keys de sección de /mes; `categoryId` para keys por categoría.
 * `mes.item.monto` acepta `categoryId` OPCIONAL (limita a esa categoría; ausente =
 * aplica a cualquier ítem sin importar su categoría).
 */
export interface LimitRefinement {
  section?: LimitSectionRefinement;
  categoryId?: string;
}

/**
 * Un límite: observa un dato (vía `anchorKey`), lo compara contra `threshold` y,
 * si se cumple, dispara un efecto según su `nature`: "passive" aplica `effect`
 * al renderizar; "active" abre el aviso de confirmación al guardar (sin `effect`
 * ni `temporalScope`, D20).
 *
 * `id` se genera en el front (key de React / borrar). `threshold` es un número
 * puro sin moneda (D3): su unidad (money/percent/count/signed-money) la fija el
 * `unit` de `anchorKey` en el catálogo — NO vive en el límite.
 */
export interface LimitConfig {
  /** Id local, generado en el front (crypto.randomUUID / fallback). */
  id: string;
  /** Nombre dado por el usuario; ausente = placeholder derivado de la key + condición. */
  label?: string;
  /** Toggle on/off sin borrar la regla. */
  enabled: boolean;
  /** Key del catálogo hardcodeado (lib/limits/catalog.ts) que este límite observa. */
  anchorKey: string;
  /** Presente solo si la key lo requiere/admite (ver catálogo). */
  refinement?: LimitRefinement;
  /**
   * Default "all" (D4). Requerido en la práctica para `nature: "passive"`.
   * AUSENTE para `nature: "active"` (D20 — no aplica: la activa siempre
   * proyecta sobre el mes destino del movimiento; el panel omite el selector).
   */
  temporalScope?: LimitTemporalScope;
  operator: LimitOperator;
  /** Número puro de comparación, en la unidad del `unit` de `anchorKey`. */
  threshold: number;
  nature: LimitNature;
  /** Solo para `nature === "passive"`. Debe pertenecer al subset válido de la key. */
  effect?: LimitEffect;
}
