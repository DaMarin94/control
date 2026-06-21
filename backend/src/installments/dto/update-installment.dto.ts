import {
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
import { Currency } from '@prisma/client';

/**
 * DTO para editar un grupo de cuotas (PATCH /installments/:id).
 *
 * Campos editables: amountCents, totalInstallments, startMonth, categoryId, description.
 * - type NO es editable (las cuotas son siempre EXPENSE en v1).
 * - description puede venir null explícito para limpiarla.
 *
 * No recibe currentMonth (D2): las cuotas no tienen inmutabilidad del pasado;
 * la edición aplica al grupo completo (RF-MC-003).
 */
export class UpdateInstallmentDto {
  @IsOptional()
  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents?: number;

  @IsOptional()
  @IsInt({ message: 'La cantidad de cuotas debe ser un entero' })
  @Min(1, { message: 'La cantidad de cuotas debe ser mayor a 0' })
  totalInstallments?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'startMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  startMonth?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  /** Moneda del grupo. Opcional. Fase 1.2.4: acepta ARS, USD, EUR, BRL. */
  @IsOptional()
  @IsEnum(Currency, { message: 'currency debe ser ARS, USD, EUR o BRL' })
  currency?: Currency;

  /** Cotización ARS/1 USD. Número positivo con decimales. Opcional. Fase 1.2.3. */
  @IsOptional()
  @IsNumber({}, { message: 'exchangeRate debe ser un número' })
  @IsPositive({ message: 'exchangeRate debe ser un número positivo' })
  exchangeRate?: number;
}
