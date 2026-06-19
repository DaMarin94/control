import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { FormulaOperator } from '@prisma/client';

/**
 * DTO para editar un movimiento calculado derivado de un grupo de cuotas
 * (PATCH /installments/:id/calculated — Fase 1.1.7.ext).
 *
 * El calculado de cuota NO tiene split (edita in-place siempre):
 * el grupo de cuotas tampoco tiene split, y el calculado hereda ese comportamiento.
 * NO acepta `currentMonth` (no hay lógica de split).
 * NO acepta `type` (se deriva del signo del monto resultante — RF-MCALC-003).
 *
 * Campos editables: categoryId, description, formulaOperator, formulaOperand, formulaSign.
 * NO editable: sourceInstallmentGroupId (el vínculo al origen es inmutable).
 */
export class UpdateCalculatedFromInstallmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(FormulaOperator, {
    message: 'El operador debe ser ADD, SUB, MUL, DIV o PCT',
  })
  formulaOperator?: FormulaOperator;

  /**
   * Operando ya escalado como entero.
   * Para DIV y PCT, el valor 0 es rechazado en el service.
   */
  @IsOptional()
  @IsInt({ message: 'El operando debe ser un entero escalado' })
  formulaOperand?: number;

  @IsOptional()
  @IsIn([1, -1], { message: 'El signo debe ser 1 (positivo) o -1 (negativo)' })
  formulaSign?: number;
}
