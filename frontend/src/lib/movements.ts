/**
 * Helpers de lógica de movimientos compartida entre componentes.
 *
 * RN-019 (encapsulado aquí): la contribución de un MovementItem a los totales
 * es SIEMPRE Math.abs(convertedAmountCents) en el bucket de su `type` derivado.
 *
 * Motivación:
 * - Fase 1.2.3 (multi-moneda): los totales deben expresarse en la moneda default
 *   del usuario. `convertedAmountCents` es el monto ya convertido a esa moneda
 *   por el backend. `amountCents` conserva la moneda original del ítem y NO debe
 *   usarse para sumar totales en `/mes` (los totales de pantalla serían en monedas
 *   distintas si el usuario mezcla monedas).
 * - Los movimientos calculados almacenan `convertedAmountCents` CON signo
 *   (los EXPENSE calculados lo tienen negativo). La suma directa del crudo
 *   produciría totales incorrectos; Math.abs() garantiza la magnitud correcta.
 * - El backend suma `convertedAmountCents` por tipo en `getMonthMovements`;
 *   esta función replica esa regla para que el total recalculado en cliente
 *   (tras filtros por listado) coincida con `data.totals` cuando no hay filtro.
 */

import type { MovementItem } from "@/types/movement";

/**
 * Dada una lista de MovementItem, devuelve la suma de magnitudes convertidas por tipo.
 *
 * Usa `convertedAmountCents` (moneda default del usuario, asignada por el backend)
 * en lugar de `amountCents` (moneda original). Math.abs() normaliza el signo de
 * los calculados EXPENSE (que almacenan convertedAmountCents negativo).
 *
 * @returns { expense, income } — ambos siempre positivos (magnitudes, no signed).
 */
export function sumMovementTotals(items: MovementItem[]): {
  expense: number;
  income: number;
} {
  return items.reduce(
    (acc, m) => {
      const magnitude = Math.abs(m.convertedAmountCents);
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
