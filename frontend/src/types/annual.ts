/**
 * Tipos del contrato de serie anual — GET /movements/annual?year=YYYY
 *
 * Fuente de verdad: docs/data-model.md, sección "Contrato de serie anual".
 * El frontend define sus propios tipos reflejando el contrato; no hay paquete
 * compartido con el backend.
 */

/** Un mes del año con sus totales de ingreso y gasto. Siempre 12, ene→dic. */
export interface AnnualMonth {
  /** "YYYY-MM" */
  month: string;
  /** Suma de ingresos del mes en centavos (únicos + fijos + cuotas). */
  incomeCents: number;
  /** Suma de gastos del mes en centavos (únicos + fijos + cuotas). */
  expenseCents: number;
}

/** Categoría con su gasto mensual desagregado. Solo categorías con gasto EXPENSE. */
export interface AnnualCategory {
  categoryId: string;
  name: string;
  /** Color hex del pool de categorías, ej. "#4F86C6". */
  color: string;
  /**
   * Exactamente 12 valores, ene→dic.
   * 0 donde no hay gasto en ese mes.
   * Invariante: sum(categories[*].monthlyExpenseCents[i]) == months[i].expenseCents.
   */
  monthlyExpenseCents: number[];
}

/** Respuesta de GET /movements/annual?year=YYYY (dentro del sobre { success, data }). */
export interface AnnualMovementsResponse {
  /** El año pedido. */
  year: number;
  /** Siempre 12 entradas, ene→dic, en orden. */
  months: AnnualMonth[];
  /** Solo categorías con gasto EXPENSE en el año. Ordenadas por gasto anual total DESC. */
  categories: AnnualCategory[];
  /**
   * Año más antiguo con algún movimiento del usuario.
   * null si el usuario no tiene ningún movimiento.
   * El front lo usa para deshabilitar la navegación ‹ antes del primer año.
   */
  earliestYear: number | null;
}
