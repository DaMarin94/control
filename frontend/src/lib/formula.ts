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

/**
 * Variante de `buildFormulaExpression` para el caso "mes base sin dato"
 * (docs/design.md §"Mes del monto base del calculado (desfasaje 0..12) —
 * las tres superficies", preview "no puede mentir"): con `sourceMonthOffset
 * > 0` y el origen sin resolver en el mes de referencia, la expresión NO cae
 * al placeholder genérico "origen" — nombra el mes de referencia en su lugar
 * (ej. "10% del monto de Nov 2026"), para no confundir "sin dato" con
 * "cálculo sobre el mes en curso".
 *
 * @param baseMonthLabel Mes de referencia ya formateado (`formatMonthShort`).
 */
export function buildFormulaExpressionWithMonthPlaceholder(
  operator: FormulaOperator,
  userOperand: number | null,
  currency: string,
  baseMonthLabel: string,
): string {
  if (userOperand === null) return "—";
  const originPhrase = `el monto de ${baseMonthLabel}`;
  switch (operator) {
    case "ADD":
      return `${originPhrase} + ${formatCurrency(userOperand * 100, currency)}`;
    case "SUB":
      return `${originPhrase} − ${formatCurrency(userOperand * 100, currency)}`;
    case "MUL":
      return `${originPhrase} × ${String(userOperand).replace(".", ",")}`;
    case "DIV":
      return `${originPhrase} ÷ ${String(userOperand).replace(".", ",")}`;
    case "PCT":
      return `${String(userOperand).replace(".", ",")}% del monto de ${baseMonthLabel}`;
  }
}

/**
 * Etiqueta legible del "mes del monto base" (desfasaje 0..12) — fuente única
 * reutilizada por el selector del form de calculado (13 `<option>`, orden
 * 0→12) y por la fila `formula` del historial de cambios (para que una
 * edición que cambia solo el desfasaje se lea como cambio). Registro híbrido
 * deliberado, mismo criterio que "Frecuencia del fijo" (docs/design.md).
 */
export function sourceMonthOffsetLabel(offset: number): string {
  if (offset === 0) return "El mismo mes";
  if (offset === 1) return "El mes anterior";
  return `${offset} meses antes`;
}
