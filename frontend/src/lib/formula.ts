/**
 * Helpers puros de la fórmula de movimientos calculados (RF-MCALC-002),
 * extraídos de `CalculatedForm` para reutilizarlos también en la card de
 * detalle de movimiento (docs/design.md §"Card de detalle de movimiento" —
 * bloque Fórmula: "reusando el builder del preview del form de calculado").
 */

import type { FormulaOperator } from "@/types/movement";
import { formatCurrency } from "@/lib/format";

/**
 * Desescala el operando almacenado (entero del backend) al float de usuario.
 *
 * ADD/SUB: centavos → pesos (÷100)
 * MUL/DIV: factor × 1.000.000 → factor (÷1.000.000)
 * PCT: porcentaje × 100 → porcentaje (÷100)
 */
export function descaleOperand(scaled: number, operator: FormulaOperator): number {
  switch (operator) {
    case "ADD":
    case "SUB":
      return scaled / 100;
    case "MUL":
    case "DIV":
      return scaled / 1_000_000;
    case "PCT":
      return scaled / 100;
  }
}

/**
 * Construye la expresión legible de la fórmula (ej. "10% de $5.000").
 *
 * @param originCents  Monto del origen en centavos (moneda `currency`). `null`
 *   si no está disponible — en ese caso la expresión queda en forma abstracta
 *   ("origen" en vez de la cifra), sin cortar la fórmula.
 * @param operator     Operador de la fórmula.
 * @param userOperand  Operando desescalado (float, en unidad de usuario). `null`
 *   si aún no es válido (form en construcción) → devuelve "—".
 * @param currency     Moneda en la que se formatean origen y operando (ADD/SUB).
 */
export function buildFormulaExpression(
  originCents: number | null,
  operator: FormulaOperator,
  userOperand: number | null,
  currency: string,
): string {
  if (userOperand === null) return "—";
  const originFmt = originCents !== null ? formatCurrency(originCents, currency) : "origen";
  switch (operator) {
    case "ADD":
      return `${originFmt} + ${formatCurrency(userOperand * 100, currency)}`;
    case "SUB":
      return `${originFmt} − ${formatCurrency(userOperand * 100, currency)}`;
    case "MUL":
      return `${originFmt} × ${String(userOperand).replace(".", ",")}`;
    case "DIV":
      return `${originFmt} ÷ ${String(userOperand).replace(".", ",")}`;
    case "PCT":
      return `${String(userOperand).replace(".", ",")}% de ${originFmt}`;
  }
}
