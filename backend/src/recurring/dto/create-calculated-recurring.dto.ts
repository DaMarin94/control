import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { FormulaOperator } from '@prisma/client';

/**
 * DTO para crear un movimiento calculado (POST /recurring/:id/calculated).
 *
 * Un movimiento calculado es un fijo cuyo monto se deriva on-the-fly del monto
 * del fijo de origen en cada mes. El origen es el fijo con id = :id en la ruta.
 *
 * Cambio Fase 1.1.7 (RF-MCALC-003): el `type` NO se elige — se deriva del signo
 * del monto resultante en cada mes (final < 0 → EXPENSE; final > 0 → INCOME;
 * final == 0 → EXPENSE por convención). El DTO NO acepta `type`; si llega,
 * la whitelist de class-validator lo ignora automáticamente.
 *
 * Reglas de validación:
 * - categoryId: categoría propia del calculado (propia, activa, scope compatible RN-010)
 *   NOTA: como el type es derivado y varía mes a mes, la validación de scope en
 *   creación/edición se hace con scope BOTH para no rechazar categorías válidas.
 *   El servicio valida scope compatible con BOTH (acepta EXPENSE, INCOME, BOTH).
 * - startMonth: mes de inicio del calculado (YYYY-MM). El front usa el mes desde
 *   el que se abre la acción en /mes. El calculado aparece desde este mes.
 * - formulaOperator: operador de la fórmula (ADD|SUB|MUL|DIV|PCT)
 * - formulaOperand: operando de la fórmula.
 *   - ADD/SUB: monto en centavos (entero, puede ser cualquier valor ≥ 0)
 *   - MUL/DIV: factor × 1_000_000 (ej. 1.5 → 1_500_000). Enviado por el front
 *     ya en esa escala como entero.
 *   - PCT: porcentaje × 100 (ej. 10% → 1000, 1.5% → 150). Enviado por el front
 *     en esa escala como entero.
 *   DIV y PCT rechazan operando 0 (RN-017, división por cero).
 * - formulaSign: 1 (positivo) o -1 (negativo) — signo del resultado (RN-018)
 * - description: descripción propia (opcional)
 * - frequency: NO se acepta. El calculado hereda la frequency del origen (gating).
 *
 * NOTA sobre operandos:
 * Para simplificar la API y mantener precisión entera, el front envía todos los
 * operandos ya escalados como enteros:
 *   ADD/SUB → centavos directamente (ej. $50 = 5000)
 *   MUL/DIV → factor × 1_000_000 (ej. 1.5× = 1_500_000)
 *   PCT     → pct × 100 (ej. 10% = 1000, 1.5% = 150)
 */
export class CreateCalculatedRecurringDto {
  // `type` NO se acepta en este DTO (RF-MCALC-003).
  // El type se deriva del signo del monto resultante en cada mes on-the-fly.
  // Si el front lo envía, la whitelist de class-transformer lo elimina automáticamente.

  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'startMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  startMonth!: string;

  @IsEnum(FormulaOperator, {
    message: 'El operador debe ser ADD, SUB, MUL, DIV o PCT',
  })
  formulaOperator!: FormulaOperator;

  /**
   * Operando ya escalado como entero (ver NOTA arriba).
   * Para DIV y PCT, el valor 0 es rechazado en el service (RN-017).
   */
  @IsInt({ message: 'El operando debe ser un entero escalado' })
  formulaOperand!: number;

  /**
   * Signo del resultado: 1 (positivo) o -1 (negativo).
   */
  @IsIn([1, -1], { message: 'El signo debe ser 1 (positivo) o -1 (negativo)' })
  formulaSign!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La descripción no puede superar los 200 caracteres' })
  description?: string;
}

// Silenciar el warning de ValidateIf importado pero no usado tras la refactorización
void ValidateIf;
