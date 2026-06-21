import { IsEnum, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { Currency } from '@prisma/client';

/**
 * DTO para actualizar los settings del usuario (PATCH /settings).
 *
 * Campos editables:
 * - defaultCurrency: moneda default del usuario (ARS | USD | EUR | BRL), opcional.
 *   Fase 1.2.4: ampliado de ARS|USD a las 4 monedas del set curado.
 * - lastExchangeRate: última cotización usada, número positivo con decimales, opcional.
 *   Semántica: unidades de la nueva default por 1 unidad de la anterior (si hubo cambio).
 *   En práctica el frontend lo gestiona; el backend solo lo persiste.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(Currency, {
    message: 'defaultCurrency debe ser ARS, USD, EUR o BRL',
  })
  defaultCurrency?: Currency;

  @IsOptional()
  @IsNumber({}, { message: 'lastExchangeRate debe ser un número' })
  @IsPositive({ message: 'lastExchangeRate debe ser un número positivo' })
  lastExchangeRate?: number;
}
