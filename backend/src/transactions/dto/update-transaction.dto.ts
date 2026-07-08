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
 * DTO para editar un movimiento único (PATCH /transactions/:id).
 *
 * Todos los campos son opcionales — es un partial de CreateTransactionDto.
 * Si se cambia el type, el backend revalida que la categoría sea compatible
 * con el nuevo type (RN-010).
 */
export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(MovementType, {
    message: 'El tipo debe ser EXPENSE o INCOME',
  })
  type?: MovementType;

  @IsOptional()
  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  @Max(2147483647, { message: 'El monto es demasiado grande' })
  amountCents?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'occurredAt debe ser una fecha ISO 8601 válida' },
  )
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El timezone no puede estar vacío' })
  timezone?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Moneda del movimiento (ARS | USD | EUR | BRL). Opcional. Fase 1.2.4: +EUR +BRL. */
  @IsOptional()
  @IsEnum(Currency, { message: 'currency debe ser ARS, USD, EUR o BRL' })
  currency?: Currency;

  /** Cotización ARS/1 USD. Número positivo con decimales. Fase 1.2.3. */
  @IsOptional()
  @IsNumber({}, { message: 'exchangeRate debe ser un número' })
  @IsPositive({ message: 'exchangeRate debe ser un número positivo' })
  exchangeRate?: number;

  /**
   * Método de pago asociado, opcional (RF-PM-006). `null` explícito lo desasocia
   * ("(ninguno)" en el selector); ausente = no se toca.
   */
  @IsOptional()
  @IsString()
  paymentMethodId?: string | null;

  /**
   * Débito automático, opcional (P4 — corrección de alcance). Atributo del MOVIMIENTO,
   * no del método de pago. Solo se persiste si el paymentMethodId efectivo apunta a un
   * método de tipo DEBIT; en cualquier otro caso el backend lo ignora (queda null).
   */
  @IsOptional()
  @IsBoolean({ message: 'autoDebit debe ser booleano' })
  autoDebit?: boolean;
}
