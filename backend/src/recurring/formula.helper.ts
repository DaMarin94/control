import { BadRequestException } from '@nestjs/common';
import { FormulaOperator } from '@prisma/client';

/**
 * Escala de cada operador para la persistencia del operando como entero.
 *
 * ADD/SUB: el operando es en centavos (misma escala que amountCents).
 *   Se almacena y se recibe en centavos directamente.
 *   Ej: "sumar $500" → operand = 50000 (centavos).
 *
 * MUL/DIV: el operando es un factor × FACTOR_SCALE (1_000_000 = 6 decimales).
 *   Ej: "multiplicar por 1.5" → operand = 1_500_000.
 *   Ej: "dividir por 2" → operand = 2_000_000.
 *
 * PCT: el operando es porcentaje × PCT_SCALE (100).
 *   Ej: "10%" → operand = 1000; "1.5%" → operand = 150; "0.5%" → operand = 50.
 */
export const FACTOR_SCALE = 1_000_000;
export const PCT_SCALE = 100;

/**
 * Aplica la fórmula del calculado sobre el monto del origen y devuelve el resultado
 * en centavos (redondeado a centavo entero y multiplicado por formulaSign).
 *
 * Lanzará BadRequestException si el operando es 0 en DIV o PCT (RN-017).
 * Se llama solo en runtime; en validación de POST/PATCH la validación de operand=0 para DIV/PCT
 * se hace en el service.
 *
 * @param sourceAmountCents  Monto del fijo de origen en centavos para el mes.
 * @param operator           Operador de la fórmula.
 * @param operand            Operando escalado (entero) — ver escala arriba.
 * @param sign               1 (positivo) o -1 (negativo).
 * @returns                  amountCents derivado (puede ser negativo o cero — RN-018).
 */
export function applyFormula(
  sourceAmountCents: number,
  operator: FormulaOperator,
  operand: number,
  sign: number,
): number {
  let raw: number;

  switch (operator) {
    case FormulaOperator.ADD:
      // operand en centavos; sourceAmountCents + operand
      raw = sourceAmountCents + operand;
      break;

    case FormulaOperator.SUB:
      // operand en centavos; sourceAmountCents - operand
      raw = sourceAmountCents - operand;
      break;

    case FormulaOperator.MUL:
      // operand = factor × FACTOR_SCALE; resultado = source × (operand / FACTOR_SCALE)
      raw = (sourceAmountCents * operand) / FACTOR_SCALE;
      break;

    case FormulaOperator.DIV:
      // operand = divisor × FACTOR_SCALE; resultado = source / (operand / FACTOR_SCALE)
      // Equivalente: source × FACTOR_SCALE / operand
      if (operand === 0) {
        throw new BadRequestException('El operando de la división no puede ser 0');
      }
      raw = (sourceAmountCents * FACTOR_SCALE) / operand;
      break;

    case FormulaOperator.PCT:
      // operand = pct × PCT_SCALE; resultado = source × operand / (PCT_SCALE × 100)
      // Ejemplo: 10% (operand=1000): source * 1000 / (100 * 100) = source * 0.1
      if (operand === 0) {
        throw new BadRequestException('El porcentaje no puede ser 0');
      }
      raw = (sourceAmountCents * operand) / (PCT_SCALE * 100);
      break;

    default: {
      // Exhaustive check — el compilador garantiza que nunca llega acá
      const _exhaustive: never = operator;
      throw new Error(`Operador desconocido: ${_exhaustive}`);
    }
  }

  // Redondear a centavo entero (RN-017) y aplicar signo (RN-018)
  return sign * Math.round(raw);
}

/**
 * Valida que el operando no sea 0 cuando el operador es DIV o PCT (RN-017).
 * Llamado desde el service al crear/editar un calculado, antes de persistir.
 */
export function validateFormulaOperand(
  operator: FormulaOperator,
  operand: number,
): void {
  if ((operator === FormulaOperator.DIV || operator === FormulaOperator.PCT) && operand === 0) {
    throw new BadRequestException(
      'El operando no puede ser 0 para los operadores DIV y PCT (división por cero)',
    );
  }
}
