/**
 * Tipos del contrato de serie de reportes — GET /movements/reports?year=YYYY[&categories=id1,id2,...]
 *
 * Fuente de verdad: docs/data-model.md, sección "Contrato de serie de reportes".
 * Renombre de annual.ts (Fase 1.1.5): el endpoint pasó de /movements/annual a /movements/reports
 * y se le agregó el param `categories` para filtrar por subconjunto de categorías.
 *
 * El frontend define sus propios tipos reflejando el contrato; no hay paquete
 * compartido con el backend.
 */

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
}
