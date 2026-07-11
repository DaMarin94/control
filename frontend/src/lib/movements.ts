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
import { formatCurrency } from "@/lib/format";

/**
 * Dada una lista de MovementItem, devuelve la suma de magnitudes convertidas por tipo.
 *
 * Usa `convertedAmountCents` (moneda default del usuario, asignada por el backend)
 * en lugar de `amountCents` (moneda original). Math.abs() normaliza el signo de
 * los calculados EXPENSE (que almacenan convertedAmountCents negativo).
 *
 * Los ítems anulados (`skipped === true`) se excluyen de la suma: un fijo anulado
 * no aporta al total del mes (el backend también los excluye de `totals`).
 * Únicos y cuotas nunca tienen `skipped: true`, así que no se ven afectados.
 *
 * @returns { expense, income } — ambos siempre positivos (magnitudes, no signed).
 */
export function sumMovementTotals(items: MovementItem[]): {
  expense: number;
  income: number;
} {
  return items.reduce(
    (acc, m) => {
      if (m.skipped) return acc;
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

/**
 * Cifra convertida dominante (a la moneda default) con su signo de
 * presentación, compartida entre `MovementItemRow` (col 4) y
 * `MovementDetailCard` (hero) — mismo cálculo, dos lugares (docs/design.md
 * §"Card de detalle de movimiento").
 *
 * Para calculados: `convertedAmountCents` es SIEMPRE una magnitud (≥ 0); el
 * signo real vive en `amountCents` (con signo). Para no-calculados: gastos
 * con −$, ingresos con +$ (Math.abs de `convertedAmountCents`).
 */
export function formatConvertedAmountDisplay(
  movement: MovementItem,
  defaultCurrency: string,
): string {
  if (movement.calculated) {
    const magnitude = Math.abs(movement.convertedAmountCents);
    const signedCents = movement.amountCents;
    if (signedCents === 0) return formatCurrency(0, defaultCurrency); // "$0,00" sin signo
    if (signedCents < 0) return `−${formatCurrency(magnitude, defaultCurrency)}`; // "−$1.234,56"
    return formatCurrency(magnitude, defaultCurrency); // positivo sin prefijo (valor derivado)
  }
  const cents = movement.convertedAmountCents;
  const amountFormatted = formatCurrency(Math.abs(cents), defaultCurrency);
  return movement.type === "EXPENSE" ? `−${amountFormatted}` : `+${amountFormatted}`;
}

/**
 * Etiqueta en minúscula por valor de frequency (entero 1..12) — usada en la
 * sublínea de `MovementItemRow` y (capitalizada) en la ficha de
 * `MovementDetailCard`. Fuente única: docs/design.md "Frecuencia del fijo —
 * entero 1..12 y sus etiquetas", columna "Sublínea del ítem" (híbrida: nombre
 * canónico donde existe, "cada N meses" con dígito donde no).
 */
export const FREQUENCY_LABEL: Record<number, string> = {
  1: "mensual",
  2: "bimestral",
  3: "trimestral",
  4: "cuatrimestral",
  5: "cada 5 meses",
  6: "semestral",
  7: "cada 7 meses",
  8: "cada 8 meses",
  9: "cada 9 meses",
  10: "cada 10 meses",
  11: "cada 11 meses",
  12: "anual",
};

/**
 * Ordena los ítems únicos según el criterio elegido (client-side, Ola 2 Sub-fase C).
 * Se aplica DESPUÉS del filtro, sobre el array ya filtrado.
 *
 * - "amount" (default): |amountCents| DESC (mayor magnitud arriba).
 *   El backend ya entrega los únicos en este orden; devolvemos una copia sin cambiar.
 * - "date": occurredAt DESC (más reciente arriba); desempate por |amountCents| DESC.
 *   `occurredAt` es un string ISO 8601 presente en todos los MovementItem únicos.
 *
 * No muta el array original — devuelve siempre una copia.
 */
export function sortUnicosBySort(
  items: MovementItem[],
  sort: "amount" | "date",
): MovementItem[] {
  if (sort === "amount") {
    // Orden original del backend; devolver copia sin re-ordenar.
    return [...items];
  }
  // sort === "date": occurredAt DESC, desempate |amountCents| DESC
  return [...items].sort((a, b) => {
    const dateA = a.occurredAt ?? "";
    const dateB = b.occurredAt ?? "";
    if (dateA > dateB) return -1;
    if (dateA < dateB) return 1;
    // Mismo día: |amountCents| DESC
    return Math.abs(b.amountCents) - Math.abs(a.amountCents);
  });
}
