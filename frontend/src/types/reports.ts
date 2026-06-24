/**
 * Tipos del contrato de serie de reportes — GET /movements/reports?year=YYYY[&categories=id1,id2,...][&currency=XXX]
 *
 * Fuente de verdad: docs/data-model.md, sección "Contrato de serie de reportes".
 * Renombre de annual.ts (Fase 1.1.5): el endpoint pasó de /movements/annual a /movements/reports
 * y se le agregó el param `categories` para filtrar por subconjunto de categorías.
 * Ola 3 (P3): se agrega el param `currency` para override de moneda de display por card.
 *
 * El frontend define sus propios tipos reflejando el contrato; no hay paquete
 * compartido con el backend.
 */

import type { CurrencyCode } from "@/types/settings";

/** Un mes del año con sus totales de ingreso y gasto. Siempre 12, ene→dic. */
export interface ReportMonth {
  /** "YYYY-MM" */
  month: string;
  /** Suma de ingresos del mes en centavos (únicos + fijos + cuotas), filtrada al set pedido. */
  incomeCents: number;
  /** Suma de gastos del mes en centavos (únicos + fijos + cuotas), filtrada al set pedido. */
  expenseCents: number;
}

/** Categoría con su gasto mensual desagregado. Solo categorías con gasto EXPENSE. */
export interface ReportCategory {
  categoryId: string;
  name: string;
  /** Color hex de la matriz, ej. "#4F86C6". */
  color: string;
  /**
   * Exactamente 12 valores, ene→dic.
   * 0 donde no hay gasto en ese mes.
   * Invariante: sum(categories[*].monthlyExpenseCents[i]) == months[i].expenseCents.
   */
  monthlyExpenseCents: number[];
}

/** Respuesta de GET /movements/reports?year=YYYY[&categories=...] (dentro del sobre { success, data }). */
export interface ReportsMovementsResponse {
  /** El año pedido. */
  year: number;
  /** Siempre 12 entradas, ene→dic, en orden. Filtradas al set pedido. */
  months: ReportMonth[];
  /** Solo categorías con gasto EXPENSE en el año, dentro del set pedido. Ordenadas por gasto anual total DESC. */
  categories: ReportCategory[];
  /**
   * Universo ESTABLE de categorías con gasto en el año, SIN aplicar el filtro de categorías.
   * Superconjunto de `categories`: siempre incluye todas las categorías con gasto del año,
   * independientemente del filtro activo. Siempre presente (puede ser []). Ordenado por gasto anual DESC.
   * El front lo usa como universo de la leyenda-filtro (P2_b) en lugar de useCategories.
   */
  availableCategories: Array<{ categoryId: string; name: string; color: string }>;
  /**
   * Año más antiguo con algún movimiento del usuario.
   * null si el usuario no tiene ningún movimiento.
   * NO afectado por el filtro de categorías.
   * El front lo usa para deshabilitar la navegación ‹ antes del primer año.
   */
  earliestYear: number | null;
}

// ─── Tipos de configuración de cards de reporte (Fase 1.1.5) ─────────────────

/**
 * Tipo de reporte de una card.
 * - "income-expense": Forma 1, Ingresos vs. Gastos (AreaChart)
 * - "by-category": Forma 2, Gastos por categoría apilado (BarChart)
 */
export type ReportCardType = "income-expense" | "by-category";

/**
 * Configuración persistida de una card de reporte (clave `reports` del blob de preferencias).
 * Fuente de verdad: docs/data-model.md, §Clave `reports`.
 */
export interface ReportCardConfig {
  /** Id local de la card (key de React / quitar); generado en el front (crypto.randomUUID). */
  id: string;
  /** Tipo de reporte. */
  type: ReportCardType;
  /** Año que muestra la card. */
  year: number;
  /**
   * Filtro de categorías.
   * null = todas las categorías (default al crear).
   * lista = subconjunto explícito de categoryIds seleccionados.
   */
  categoryIds: string[] | null;
  /**
   * Modo de visualización de la card income-expense.
   * false (default) = vista "Total" (áreas superpuestas agregadas, vista A).
   * true = vista "Por categoría" (stacks de áreas apiladas, vista B).
   * Solo aplica cuando type === "income-expense". En by-category, ignorado.
   */
  categoryBreakdown?: boolean;
  /**
   * Series ocultas en la vista "Total" de la card income-expense (vista A).
   * Omitido / undefined = ambas visibles (default).
   * Permite ocultar una o ambas series; si están todas ocultas → canvas vacío
   * que reutiliza el empty "Sin movimientos en {año}.".
   * Solo aplica a type === "income-expense" && categoryBreakdown === false.
   * En by-category e income-expense "Por categoría" usa categoryIds (filtro de categorías).
   */
  hiddenSeries?: Array<"income" | "expense">;
  /**
   * Moneda de display de la card (Ola 3, P3).
   * Ausente / undefined = usa la default global del usuario (back-compat: cards viejas sin
   * este campo caen a la default global automáticamente por el ?? del ReportCard).
   * Presente = override local; el backend convierte la serie a esa moneda antes de devolverla.
   * Persistido por card. Al crear, nace con la default actual del usuario.
   */
  currency?: CurrencyCode;
  /**
   * Título editable de la card (Ola 2, P4).
   * Ausente / undefined = la card muestra el placeholder "Reporte N" (N = posición 1-based
   * en el array de cards, recalculado en vivo). El placeholder es solo display: nunca se
   * persiste "Reporte N" como título; si el usuario confirma sin escribir nada, el campo
   * se omite del objeto persistido (queda ausente / undefined).
   * Presente = título propio del usuario (máx. 60 caracteres, trimmeado al persistir).
   */
  title?: string;
}

// Re-export para conveniencia de los consumidores de este módulo
export type { CurrencyCode };
