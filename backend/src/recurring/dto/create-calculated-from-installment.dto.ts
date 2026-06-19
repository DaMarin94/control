import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { FormulaOperator } from '@prisma/client';

/**
 * DTO para crear un movimiento calculado derivado de un grupo de cuotas
 * (POST /installments/:id/calculated — Fase 1.1.7.ext).
 *
 * El origen es el InstallmentGroup con id = :id en la ruta.
 * El calculado aparece en cada mes del grupo (startMonth = grupo.startMonth,
 * deletedFrom = null; el rango lo da la proyección on-the-fly del grupo).
 * Deriva del monto POR CUOTA (amountCents del InstallmentGroup).
 *
 * NO acepta `startMonth` (lo deriva el backend del grupo).
 * NO acepta `type` (se deriva del signo del monto resultante — RF-MCALC-003).
 *
 * Validaciones en el service:
 * - 404 si el InstallmentGroup no existe o no es del usuario.
 * - 400 si operando=0 para DIV/PCT.
 * - 400 si la categoría es inválida.
 */
export class CreateCalculatedFromInstallmentDto {
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId!: string;

  @IsEnum(FormulaOperator, {
    message: 'El operador debe ser ADD, SUB, MUL, DIV o PCT',
  })
  formulaOperator!: FormulaOperator;

  /**
   * Operando ya escalado como entero:
   * ADD/SUB → centavos; MUL/DIV → factor × 1_000_000; PCT → pct × 100
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
  description?: string;
}
