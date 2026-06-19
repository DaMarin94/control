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
 * DTO para crear un movimiento calculado derivado de un movimiento único
 * (POST /transactions/:id/calculated — Fase 1.1.7.ext).
 *
 * El origen es el Transaction con id = :id en la ruta.
 * El calculado aparece en UN solo mes (el mes del único), autolimitado con
 * startMonth = mes del único y deletedFrom = nextMonth(startMonth).
 *
 * NO acepta `startMonth` (lo deriva el backend del occurredAt + timezone del Transaction).
 * NO acepta `type` (se deriva del signo del monto resultante — RF-MCALC-003).
 *
 * Validaciones en el service:
 * - 404 si el Transaction no existe o no es del usuario.
 * - 400 si el Transaction es a su vez un calculado (sin encadenamiento).
 * - 400 si operando=0 para DIV/PCT.
 * - 400 si la categoría es inválida.
 */
export class CreateCalculatedFromTransactionDto {
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
