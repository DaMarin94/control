import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { FormulaOperator } from '@prisma/client';

/**
 * DTO para editar un movimiento calculado (PATCH /recurring/:id/calculated).
 *
 * Cambio Fase 1.1.7 (RF-MCALC-003): el `type` NO es editable — se deriva del signo
 * del monto resultante on-the-fly en cada mes. El DTO NO acepta `type`; si el front
 * lo envía, la whitelist de class-transformer lo elimina automáticamente.
 *
 * Campos editables de un calculado (RF-MCALC-006):
 *   - categoryId
 *   - description
 *   - formulaOperator
 *   - formulaOperand
 *   - formulaSign
 *
 * NO editables:
 *   - type: se deriva del signo del resultado (RF-MCALC-003).
 *   - sourceChainId: el vínculo al origen es inmutable. Para derivar de otro origen,
 *     se elimina el calculado y se crea uno nuevo.
 *   - frequency: se hereda del origen (no es un campo propio del calculado en v1).
 *
 * currentMonth es REQUERIDO (igual que PATCH /recurring/:id):
 *   el front manda el mes desde el que edita para determinar si aplica split o
 *   update in-place (RF-MCALC-006, misma mecánica que RF-MF-003).
 */
export class UpdateCalculatedRecurringDto {
  // `type` NO se acepta en este DTO (RF-MCALC-003).
  // El type se deriva del signo del monto resultante on-the-fly.
  // Si el front lo envía, la whitelist de class-transformer lo elimina automáticamente.

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La descripción no puede superar los 200 caracteres' })
  description?: string | null;

  @IsOptional()
  @IsEnum(FormulaOperator, {
    message: 'El operador debe ser ADD, SUB, MUL, DIV o PCT',
  })
  formulaOperator?: FormulaOperator;

  /**
   * Operando ya escalado como entero (ver create-calculated-recurring.dto.ts).
   * Para DIV y PCT, el valor 0 es rechazado en el service.
   */
  @IsOptional()
  @IsInt({ message: 'El operando debe ser un entero escalado' })
  formulaOperand?: number;

  @IsOptional()
  @IsIn([1, -1], { message: 'El signo debe ser 1 (positivo) o -1 (negativo)' })
  formulaSign?: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'currentMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  currentMonth!: string;
}
