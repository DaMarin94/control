/**
 * Helpers de lógica de movimientos compartida entre componentes.
 *
 * RN-019 (encapsulado aquí): la contribución de un MovementItem a los totales
 * es SIEMPRE Math.abs(amountCents) en el bucket de su `type` derivado.
 *
 * Motivación: los movimientos calculados almacenan `amountCents` CON signo
 * (los EXPENSE calculados tienen amountCents negativo). La suma directa del
 * crudo produciría totales incorrectos. Math.abs() garantiza que el cálculo
 * del frontend coincida con lo que devuelve el backend (que usa la misma
 * regla en getMonthMovements).
 */

import type { MovementItem } from "@/types/movement";

/**
 * Dada una lista de MovementItem, devuelve la suma de magnitudes por tipo.
 *
 * @returns { expense, income } — ambos siempre positivos (magnitudes, no signed).
 */
export function sumMovementTotals(items: MovementItem[]): {
  expense: number;
  income: number;
} {
  return items.reduce(
    (acc, m) => {
      const magnitude = Math.abs(m.amountCents);
      if (m.type === "EXPENSE") acc.expense += magnitude;
      else acc.income += magnitude;
      return acc;
    },
    { expense: 0, income: 0 },
  );
}

/**
 * Calcula el subtotal neto de un grupo de ítems para mostrar en la cabecera
 * de sección: ingresos suman positivo, gastos restan (usando magnitudes).
 *
 * El signo de presentación es: income_magnitude − expense_magnitude.
 *
 * @returns Número con signo: positivo = neto income, negativo = neto expense.
 */
export function groupSubtotalCents(items: MovementItem[]): number {
  const { expense, income } = sumMovementTotals(items);
  return income - expense;
}
