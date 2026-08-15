/**
 * Catálogo de keys hardcodeadas de Límites y Alertas — el "lenguaje común"
 * entre anclajes (emisores) y el panel de config + evaluador (consumidores).
 *
 * Fuente funcional: docs/roadmap-limites-alertas.md §2 (catálogo completo).
 * Fuente visual del subset de efectos por anclaje: docs/design.md
 * §"Marca visual pasiva de límites" → "Mapeo efecto ↔ tipo de anclaje".
 *
 * Este registro es la ÚNICA fuente de verdad que consumen tanto el panel de
 * config (para ofrecer opciones) como el evaluador (lib/limits/evaluate.ts).
 * Ni el panel ni los anclajes inventan keys en runtime (roadmap §5, "Relación
 * límites ↔ keys").
 *
 * ALCANCE:
 * - Tramo 1 (Fase 1): las 7 keys `mes.*` ofrecidas (`offeredInPanel: true`) y
 *   cableadas en /mes.
 * - Tramo 2 (Fase 1): las 15 keys de reportes/dashboard-widget quedan también
 *   `offeredInPanel: true` y cableadas en el dashboard (resumen + widget
 *   income-expense efímero) y en las 5 cards de `/reportes`. El dashboard
 *   reutiliza las keys `mes.total.*` / `mes.balance` (ya ofrecidas en tramo 1)
 *   para el mes en curso (roadmap §2) — no tiene keys propias; su widget
 *   income-expense efímero emite `reporte.ie.*`.
 */

import type { LimitEffect, LimitOperator } from "@/types/limit";

// ─── Tipos de soporte del catálogo ─────────────────────────────────────────────

/** Unidad del dato — determina cómo se interpreta `threshold` y qué input ofrece el panel. */
export type LimitUnit = "money" | "signed-money" | "percent" | "count";

/** Agrupación de pantalla/objeto — cómo el panel agrupa las keys en el picker (§5). */
export type LimitSurface =
  | "mes"
  | "reporte-income-expense"
  | "reporte-by-category"
  | "reporte-unique-grid"
  | "reporte-installment-gantt"
  | "reporte-inflation-income";

/** Etiquetas legibles de agrupación, en el orden en que se muestran en el panel. */
export const SURFACE_LABELS: Record<LimitSurface, string> = {
  mes: "Vista del mes",
  "reporte-income-expense": "Ingresos vs Gastos",
  "reporte-by-category": "Gastos por categoría",
  "reporte-unique-grid": "Gastos Únicos",
  "reporte-installment-gantt": "Gastos en Cuotas",
  "reporte-inflation-income": "Inflación vs Ingresos",
};

/**
 * Tipo de anclaje visual (docs/design.md, filas de la tabla "Mapeo efecto ↔ tipo
 * de anclaje"). Determina el subset de efectos válidos y el default.
 */
export type LimitAnchorType =
  | "line-item"
  | "month-total"
  | "section-counter"
  | "grid-cell"
  | "bar"
  | "stacked-band"
  | "stacked-month"
  | "series-point"
  | "footer-metric";

/** Tipo de refinamiento que exige/admite una key. */
export type LimitRefinementKind = "section" | "category";

export interface LimitAnchorRefinementDef {
  kind: LimitRefinementKind;
  /** true = el límite NO puede crearse sin elegir el refinamiento. */
  required: boolean;
}

export interface LimitAnchorDef {
  key: string;
  /** Rótulo legible mostrado en el picker y en la lista del panel. */
  label: string;
  surface: LimitSurface;
  anchorType: LimitAnchorType;
  unit: LimitUnit;
  refinement?: LimitAnchorRefinementDef;
  /** Subset de efectos válidos para esta key (docs/design.md, columna "Efectos válidos"). */
  effects: LimitEffect[];
  /** Efecto preseleccionado en el picker (columna "Default"). */
  defaultEffect: LimitEffect;
  /**
   * Bajada de la línea informativa cuando `effects.length === 1` (docs/design.md
   * §"Panel de gestión de límites" §4, "Subset de un solo efecto"): describe qué
   * forma toma la marca, en vez del `radiogroup` de una sola opción. Solo se lee
   * cuando `effects.length === 1`.
   */
  singleEffectDescription?: string;
  /** Naturalezas que la key admite (P/A del catálogo). Fase 1 solo consume "passive". */
  natures: Array<"passive" | "active">;
  /** true si este tramo la ofrece en el panel de creación (ver nota de alcance arriba). */
  offeredInPanel: boolean;
}

// ─── Operadores — catálogo fijo, igual para todas las unidades ────────────────

export const LIMIT_OPERATORS: { value: LimitOperator; label: string; symbol: string }[] = [
  { value: "gt", label: "mayor que", symbol: ">" },
  { value: "gte", label: "mayor o igual que", symbol: "≥" },
  { value: "lt", label: "menor que", symbol: "<" },
  { value: "lte", label: "menor o igual que", symbol: "≤" },
  { value: "eq", label: "igual a", symbol: "=" },
];

// ─── Registro completo ──────────────────────────────────────────────────────────

export const LIMIT_ANCHOR_REGISTRY: LimitAnchorDef[] = [
  // ── Vista del mes (`mes.*`) — OFRECIDAS y CABLEADAS en este tramo ───────────
  {
    key: "mes.total.gasto",
    label: "Gasto del mes",
    surface: "mes",
    anchorType: "month-total",
    unit: "money",
    // Se renderiza en --ink (neutro, no tipado) en las tarjetas de totales de /mes:
    // tint permitido (design.md, nota † de la tabla).
    effects: ["badge", "glyph", "bold", "tint", "ring"],
    defaultEffect: "badge",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },
  {
    key: "mes.total.ingreso",
    label: "Ingreso del mes",
    surface: "mes",
    anchorType: "month-total",
    unit: "money",
    // Se renderiza en --income-ink (monto tipado): tint NO se ofrece (design.md, regla dura de tint).
    effects: ["badge", "glyph", "bold", "ring"],
    defaultEffect: "badge",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },
  {
    key: "mes.balance",
    label: "Balance del mes",
    surface: "mes",
    anchorType: "month-total",
    unit: "signed-money",
    // Cifra con signo/tipo implícito (bloque de acento + signo +/−): tint no se ofrece.
    effects: ["badge", "glyph", "bold", "ring"],
    defaultEffect: "badge",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },
  {
    key: "mes.seccion.subtotal",
    label: "Subtotal de sección",
    surface: "mes",
    anchorType: "month-total",
    unit: "money",
    refinement: { kind: "section", required: true },
    // Se renderiza en --muted (neutro): tint permitido.
    effects: ["badge", "glyph", "bold", "tint", "ring"],
    defaultEffect: "badge",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },
  {
    key: "mes.seccion.conteo",
    label: "Cantidad de ítems de una sección",
    surface: "mes",
    anchorType: "section-counter",
    unit: "count",
    refinement: { kind: "section", required: true },
    effects: ["glyph", "badge"],
    defaultEffect: "glyph",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },
  {
    key: "mes.item.monto",
    label: "Monto de un movimiento",
    surface: "mes",
    anchorType: "line-item",
    unit: "money",
    // categoryId OPCIONAL (roadmap §2): sin refinamiento = aplica a cualquier ítem.
    refinement: { kind: "category", required: false },
    effects: ["glyph", "badge", "fill", "bold"],
    defaultEffect: "glyph",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },
  {
    key: "mes.categoria.gastoMes",
    label: "Gasto de una categoría en el mes",
    surface: "mes",
    // Dato derivado, sin número propio renderizado (roadmap §2, D2). Se marca reusando
    // el mismo slot/subset que la línea de movimiento: cada ítem de la categoría que
    // cruza el límite recibe la marca en su fila (zona de estados / identidad),
    // igual mecanismo que `mes.item.monto`. Asunción de implementación — docs/design.md
    // no mapea un tipo de anclaje propio para esta key derivada; reportar al orquestador.
    anchorType: "line-item",
    unit: "money",
    refinement: { kind: "category", required: true },
    effects: ["glyph", "badge", "fill", "bold"],
    defaultEffect: "glyph",
    natures: ["passive", "active"],
    offeredInPanel: true,
  },

  // ── Reportes — card income-expense (Tramo 2: ofrecidas y cableadas) ─────────
  {
    key: "reporte.ie.gastoMes",
    label: "Gasto de un mes (serie anual)",
    surface: "reporte-income-expense",
    anchorType: "series-point",
    unit: "money",
    effects: ["dot", "ring"],
    defaultEffect: "dot",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.ie.ingresoMes",
    label: "Ingreso de un mes (serie anual)",
    surface: "reporte-income-expense",
    anchorType: "series-point",
    unit: "money",
    effects: ["dot", "ring"],
    defaultEffect: "dot",
    natures: ["passive"],
    offeredInPanel: true,
  },

  // ── Reportes — card by-category (Tramo 2: ofrecidas y cableadas) ────────────
  //
  // P2 — corrección "Marcas de límite en by-category — el cartucho de mes"
  // (docs/design.md): gastoMesCategoria conserva su portador natural (la banda),
  // restringido a `ring` (única primitiva que la geometría de una banda sin
  // etiqueta de monto puede expresar sin mentir). gastoMesTotal deja de ser
  // "bar" — no es ningún elemento pintado del stack, es la columna de mes; su
  // portador es el cartucho del eje X (siempre presente, idéntico en Barra y
  // Línea). Ver también el rescate de §3 (banda inexistente → escala al
  // cartucho) implementado en apply-reports.ts.
  {
    key: "reporte.cat.gastoMesCategoria",
    label: "Gasto de una categoría en un mes",
    surface: "reporte-by-category",
    anchorType: "stacked-band",
    unit: "money",
    refinement: { kind: "category", required: true },
    effects: ["ring"],
    defaultEffect: "ring",
    singleEffectDescription: "Contorno ámbar sobre la banda de esa categoría.",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.cat.gastoMesTotal",
    label: "Total de gasto apilado del mes",
    surface: "reporte-by-category",
    anchorType: "stacked-month",
    unit: "money",
    effects: ["glyph", "badge", "ring"],
    defaultEffect: "glyph",
    natures: ["passive"],
    offeredInPanel: true,
  },

  // ── Reportes — card unique-grid (Tramo 2: ofrecidas y cableadas) ────────────
  {
    key: "reporte.unicos.celda",
    label: "Gasto Único de un día (celda)",
    surface: "reporte-unique-grid",
    anchorType: "grid-cell",
    unit: "money",
    effects: ["ring", "dot"],
    defaultEffect: "ring",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.unicos.mesTotal",
    label: "Total mensual de Únicos",
    surface: "reporte-unique-grid",
    anchorType: "footer-metric",
    unit: "money",
    effects: ["tint", "glyph", "bold"],
    defaultEffect: "tint",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.unicos.promedioDiario",
    label: "Promedio diario del mes",
    surface: "reporte-unique-grid",
    anchorType: "footer-metric",
    unit: "money",
    effects: ["tint", "glyph", "bold"],
    defaultEffect: "tint",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.unicos.pctVsPrev",
    label: "% de diferencia vs. mes anterior",
    surface: "reporte-unique-grid",
    anchorType: "footer-metric",
    unit: "percent",
    effects: ["tint", "glyph", "bold"],
    defaultEffect: "tint",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.unicos.inflacionMes",
    label: "Inflación IPC del mes (Únicos)",
    surface: "reporte-unique-grid",
    anchorType: "footer-metric",
    unit: "percent",
    effects: ["tint", "glyph", "bold"],
    defaultEffect: "tint",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.unicos.pctVsPrevAjustado",
    label: "% vs. mes anterior ajustado por inflación",
    surface: "reporte-unique-grid",
    anchorType: "footer-metric",
    unit: "percent",
    effects: ["tint", "glyph", "bold"],
    defaultEffect: "tint",
    natures: ["passive"],
    offeredInPanel: true,
  },

  // ── Reportes — card installment-gantt (Tramo 2: ofrecidas y cableadas) ──────
  {
    key: "reporte.cuotas.montoPorCuota",
    label: "Monto por cuota de una compra",
    surface: "reporte-installment-gantt",
    anchorType: "bar",
    unit: "money",
    effects: ["glyph", "badge", "ring"],
    defaultEffect: "glyph",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.cuotas.cantidadCuotas",
    label: "Cantidad total de cuotas del plan",
    surface: "reporte-installment-gantt",
    anchorType: "bar",
    unit: "count",
    effects: ["glyph", "badge", "ring"],
    defaultEffect: "glyph",
    natures: ["passive"],
    offeredInPanel: true,
  },

  // ── Reportes — card inflation-income (Tramo 2: ofrecidas y cableadas) ───────
  {
    key: "reporte.infl.inflacionMes",
    label: "Inflación IPC del mes (Inflación vs Ingresos)",
    surface: "reporte-inflation-income",
    anchorType: "series-point",
    unit: "percent",
    effects: ["dot", "ring"],
    defaultEffect: "dot",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.infl.ingresoVarMes",
    label: "Variación % mensual del ingreso (nominal)",
    surface: "reporte-inflation-income",
    anchorType: "series-point",
    unit: "percent",
    effects: ["dot", "ring"],
    defaultEffect: "dot",
    natures: ["passive"],
    offeredInPanel: true,
  },
  {
    key: "reporte.infl.ingresoVarAjustado",
    label: "Variación % mensual del ingreso ajustada por inflación",
    surface: "reporte-inflation-income",
    anchorType: "series-point",
    unit: "percent",
    effects: ["dot", "ring"],
    defaultEffect: "dot",
    natures: ["passive"],
    offeredInPanel: true,
  },
];

// ─── Helpers de consulta ────────────────────────────────────────────────────────

const REGISTRY_BY_KEY = new Map<string, LimitAnchorDef>(
  LIMIT_ANCHOR_REGISTRY.map((def) => [def.key, def]),
);

/** Busca la definición de una key del catálogo. undefined si no existe (key desconocida). */
export function getAnchorDef(anchorKey: string): LimitAnchorDef | undefined {
  return REGISTRY_BY_KEY.get(anchorKey);
}

/** Keys ofrecidas por el panel (todas las de `offeredInPanel: true`), en su orden de registro. */
export function getPanelAnchors(): LimitAnchorDef[] {
  return LIMIT_ANCHOR_REGISTRY.filter((def) => def.offeredInPanel);
}

/** Agrupa las keys ofrecidas por `surface`, preservando el orden de SURFACE_LABELS. */
export function getPanelAnchorsBySurface(): { surface: LimitSurface; anchors: LimitAnchorDef[] }[] {
  const offered = getPanelAnchors();
  const surfaces = Object.keys(SURFACE_LABELS) as LimitSurface[];
  return surfaces
    .map((surface) => ({ surface, anchors: offered.filter((a) => a.surface === surface) }))
    .filter((group) => group.anchors.length > 0);
}

export function getOperatorDef(operator: LimitOperator) {
  return LIMIT_OPERATORS.find((op) => op.value === operator);
}

// ─── Naturaleza ACTIVA — operadores por polaridad de anclaje (P2, Fase 2, D12) ──

/**
 * Polaridad de una key para la naturaleza activa (roadmap §4/§6, D12).
 * "ceiling" (techo, "no superar") → ofrece gt/gte.
 * "floor"   (piso, "no caer por debajo") → ofrece lt/lte.
 * Solo tiene sentido para las 7 keys `mes.*` que admiten `nature: "active"`
 * (`natures.includes("active")` en el registro); el resto no se consulta.
 */
export type ActiveOperatorPolarity = "ceiling" | "floor";

/**
 * Mapa CERRADO de polaridad por key — D12 + cierre de `mes.total.ingreso` (piso,
 * "avisá si el ingreso proyectado no alcanza X"). Techo: mes.total.gasto,
 * mes.seccion.subtotal, mes.seccion.conteo, mes.categoria.gastoMes, mes.item.monto.
 * Piso: mes.balance, mes.total.ingreso.
 */
const ACTIVE_ANCHOR_POLARITY: Partial<Record<string, ActiveOperatorPolarity>> = {
  "mes.total.gasto": "ceiling",
  "mes.seccion.subtotal": "ceiling",
  "mes.seccion.conteo": "ceiling",
  "mes.categoria.gastoMes": "ceiling",
  "mes.item.monto": "ceiling",
  "mes.balance": "floor",
  "mes.total.ingreso": "floor",
};

/**
 * Operadores ofrecidos por el panel cuando la naturaleza elegida es "active"
 * (D12): techo → [gt, gte]; piso → [lt, lte]. Default "ceiling" si la key no
 * está en el mapa (no debería ocurrir — el panel solo habilita "Activa" para
 * keys que admiten esa naturaleza).
 */
export function getActiveOperators(anchorKey: string): LimitOperator[] {
  const polarity = ACTIVE_ANCHOR_POLARITY[anchorKey] ?? "ceiling";
  return polarity === "floor" ? ["lt", "lte"] : ["gt", "gte"];
}

// ─── Formato de umbral / condición (compartido panel ↔ marcas) ─────────────────

/**
 * Formatea el `threshold` según el `unit` de la key — número puro, sin símbolo
 * de moneda (D3). money/signed-money: agrupación de miles es-AR. percent: sufijo
 * "%". count: entero + sustantivo neutro "ítems".
 */
export function formatThreshold(unit: LimitUnit, threshold: number): string {
  const formattedNumber = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: unit === "count" ? 0 : 2,
  }).format(threshold);

  switch (unit) {
    case "percent":
      return `${formattedNumber}%`;
    case "count":
      return `${formattedNumber} ítems`;
    case "money":
    case "signed-money":
    default:
      return formattedNumber;
  }
}

/** Arma el fragmento "{símbolo} {umbral formateado}" (ej. "> 300.000"). */
export function formatCondition(unit: LimitUnit, operator: LimitOperator, threshold: number): string {
  const op = getOperatorDef(operator);
  return `${op?.symbol ?? operator} ${formatThreshold(unit, threshold)}`;
}

/**
 * Placeholder derivado cuando el límite no tiene `label` propio: "{key legible} {condición}".
 * Usado como nombre por defecto en la lista y como `placeholder` del input "Nombre (opcional)".
 */
export function deriveLimitLabel(anchorKey: string, operator: LimitOperator, threshold: number): string {
  const def = getAnchorDef(anchorKey);
  const unit = def?.unit ?? "money";
  const anchorLabel = def?.label ?? anchorKey;
  return `${anchorLabel} ${formatCondition(unit, operator, threshold)}`;
}
