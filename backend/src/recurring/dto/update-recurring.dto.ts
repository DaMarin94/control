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
  Max,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';

/**
 * DTO para editar un movimiento fijo (PATCH /recurring/:id).
 *
 * Campos editables: SOLO amountCents, categoryId, description (RF-MF-003).
 * - type NO se edita (RF-MF-003 — decisión D1).
 * - startMonth NO se edita.
 * - currentMonth es REQUERIDO (decisión D2): el front manda el mes actual
 *   para determinar si aplica split o update in-place.
 * - description puede venir null explícito para limpiarla, o string para actualizarla.
 */
export class UpdateRecurringDto {
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
  @IsString()
  description?: string | null;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'currentMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  currentMonth!: string;

  /**
   * Cotización ARS/1 USD para el mes editado. Opcional.
   * Al editar con split, la fila nueva R2 usa esta cotización.
   * Fase 1.2.3.
   */
  @IsOptional()
  @IsNumber({}, { message: 'exchangeRate debe ser un número' })
  @IsPositive({ message: 'exchangeRate debe ser un número positivo' })
  exchangeRate?: number;

  /**
   * Moneda del fijo. Opcional. Inmutable conceptualmente en la cadena vigente,
   * pero editable al hacer split (la fila nueva puede tener distinta moneda).
   * Fase 1.2.3.
   */
  @IsOptional()
  @IsEnum(Currency, { message: 'currency debe ser ARS, USD, EUR o BRL' })
  currency?: Currency;

  /**
   * Método de pago asociado, opcional (RF-PM-006). `null` explícito lo desasocia
   * ("(ninguno)" en el selector); ausente = no se toca. Aplica desde el mes editado
   * en adelante (sigue el mismo pivote de split que el resto de los campos editables).
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
