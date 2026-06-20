import { IsEnum, IsOptional, IsNumber, Min, IsPositive } from 'class-validator';
import { Currency } from '@prisma/client';

/**
 * DTO para actualizar los settings del usuario (PATCH /settings).
 *
 * Campos editables:
 * - defaultCurrency: moneda default del usuario (ARS | USD), opcional.
 * - lastExchangeRate: última cotización ARS/1 USD, número positivo con decimales, opcional.
 *   El frontend la puede enviar al guardar un movimiento con cotización.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(Currency, {
    message: 'defaultCurrency debe ser ARS o USD',
  })
  defaultCurrency?: Currency;

  @IsOptional()
  @IsNumber({}, { message: 'lastExchangeRate debe ser un número' })
  @IsPositive({ message: 'lastExchangeRate debe ser un número positivo' })
  lastExchangeRate?: number;
}
