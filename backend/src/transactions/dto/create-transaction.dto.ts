import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Currency, MovementType } from '@prisma/client';

/**
 * DTO para crear un movimiento único (POST /transactions).
 *
 * Reglas de validación:
 * - type: enum MovementType (EXPENSE | INCOME), obligatorio
 * - amountCents: entero en centavos, > 0 (RN-002)
 * - categoryId: string no vacío, obligatorio
 * - occurredAt: fecha ISO 8601 con offset explícito (ej: "2026-06-08T14:30:00-03:00"),
 *   se almacena en UTC via @db.Timestamptz (RN-004)
 * - timezone: nombre IANA (ej: "America/Argentina/Buenos_Aires"), obligatorio,
 *   se guarda con el registro para bucketeo por mes y mostrar hora local original
 * - description: texto libre, opcional
 *
 * El color y el userId NO se aceptan en el body — son ignorados por whitelist.
 */
export class CreateTransactionDto {
  @IsEnum(MovementType, {
    message: 'El tipo debe ser EXPENSE o INCOME',
  })
  type!: MovementType;

  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  @Max(2147483647, { message: 'El monto es demasiado grande' })
  amountCents!: number;

  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId!: string;

  @IsISO8601(
    { strict: true },
    { message: 'occurredAt debe ser una fecha ISO 8601 válida' },
  )
  occurredAt!: string;

  @IsString()
  @IsNotEmpty({ message: 'El timezone no puede estar vacío' })
  timezone!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Moneda del movimiento (ARS o USD). Opcional — default ARS.
   * Fase 1.2.3.
   */
  @IsOptional()
  @IsEnum(Currency, { message: 'currency debe ser ARS, USD, EUR o BRL' })
  currency?: Currency;

  /**
   * Cotización ARS/1 USD al momento del movimiento. Opcional — default 1.
   * Número positivo con decimales (no centavos).
   * Fase 1.2.3.
   */
  @IsOptional()
  @IsNumber({}, { message: 'exchangeRate debe ser un número' })
  @IsPositive({ message: 'exchangeRate debe ser un número positivo' })
  exchangeRate?: number;

  /**
   * Método de pago asociado, opcional (RF-PM-006). Debe ser propio del usuario y activo.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El paymentMethodId no puede estar vacío' })
  paymentMethodId?: string;

  /**
   * Débito automático, opcional (P4 — corrección de alcance). Atributo del MOVIMIENTO,
   * no del método de pago. Solo se persiste si paymentMethodId apunta a un método de
   * tipo DEBIT; en cualquier otro caso el backend lo ignora (queda null).
   */
  @IsOptional()
  @IsBoolean({ message: 'autoDebit debe ser booleano' })
  autoDebit?: boolean;
}
