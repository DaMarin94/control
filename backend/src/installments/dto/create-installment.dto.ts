import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Currency, MovementType } from '@prisma/client';

/**
 * DTO para crear un grupo de cuotas (POST /installments).
 *
 * Reglas de validación:
 * - type: enum MovementType, PERO solo EXPENSE está permitido en v1.
 *   El service rechaza INCOME con 400 (decisión cerrada — conflicto RF-MC-001 vs sección 6).
 * - amountCents: entero en centavos POR CUOTA (no el total), > 0 (RN-002)
 * - totalInstallments: entero > 0 (cantidad de cuotas)
 * - categoryId: string no vacío, obligatorio. Debe tener scope EXPENSE o BOTH (RN-010).
 * - startMonth: mes de inicio en formato YYYY-MM (D2 — el front calcula y manda)
 * - description: texto libre, opcional
 *
 * El userId NO se acepta en el body — se toma siempre de request.user.userId.
 */
export class CreateInstallmentDto {
  @IsEnum(MovementType, {
    message: 'El tipo debe ser EXPENSE o INCOME',
  })
  type!: MovementType;

  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents!: number;

  @IsInt({ message: 'La cantidad de cuotas debe ser un entero' })
  @Min(1, { message: 'La cantidad de cuotas debe ser mayor a 0' })
  totalInstallments!: number;

  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'startMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  startMonth!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Moneda del grupo de cuotas (ARS o USD). Única para todo el grupo.
   * Opcional — default ARS. Fase 1.2.3.
   */
  @IsOptional()
  @IsEnum(Currency, { message: 'currency debe ser ARS, USD, EUR o BRL' })
  currency?: Currency;

  /**
   * Cotización ARS/1 USD. Única para todo el grupo de cuotas.
   * Número positivo con decimales. Opcional — default 1. Fase 1.2.3.
   */
  @IsOptional()
  @IsNumber({}, { message: 'exchangeRate debe ser un número' })
  @IsPositive({ message: 'exchangeRate debe ser un número positivo' })
  exchangeRate?: number;

  /**
   * Método de pago asociado, opcional (RF-PM-006). Único para todo el grupo.
   * Debe ser propio del usuario y activo.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El paymentMethodId no puede estar vacío' })
  paymentMethodId?: string;

  /**
   * Débito automático, opcional (P4 — corrección de alcance). Atributo del MOVIMIENTO,
   * no del método de pago. Único para todo el grupo. Solo se persiste si paymentMethodId
   * apunta a un método de tipo DEBIT; en cualquier otro caso queda null.
   */
  @IsOptional()
  @IsBoolean({ message: 'autoDebit debe ser booleano' })
  autoDebit?: boolean;
}
