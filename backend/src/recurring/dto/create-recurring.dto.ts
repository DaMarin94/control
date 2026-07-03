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
import { Currency, MovementType, RecurringFrequency } from '@prisma/client';

/**
 * DTO para crear un movimiento fijo (POST /recurring).
 *
 * Reglas de validación:
 * - type: enum MovementType (EXPENSE | INCOME), obligatorio
 * - amountCents: entero en centavos, > 0 (RN-002)
 * - categoryId: string no vacío, obligatorio
 * - startMonth: mes en formato YYYY-MM (obligatorio). El front lo calcula con browser tz;
 *   el backend es tz-agnóstico (D2).
 * - frequency: enum RecurringFrequency (P2 — Fase 1.1.1), opcional — default MONTHLY.
 *   Set cerrado: MONTHLY | BIMONTHLY | QUARTERLY | BIANNUAL | ANNUAL.
 *   La frecuencia está anclada al startMonth: un fijo BIMONTHLY que arranca en marzo
 *   aparece en marzo, mayo, julio, etc.
 * - description: texto libre, opcional
 *
 * El userId NO se acepta en el body — se toma siempre de request.user.userId.
 * El color y el type de la categoría NO se incluyen — son ignorados por whitelist.
 */
export class CreateRecurringDto {
  @IsEnum(MovementType, {
    message: 'El tipo debe ser EXPENSE o INCOME',
  })
  type!: MovementType;

  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents!: number;

  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'startMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  startMonth!: string;

  @IsOptional()
  @IsEnum(RecurringFrequency, {
    message: 'La frecuencia debe ser MONTHLY, BIMONTHLY, QUARTERLY, BIANNUAL o ANNUAL',
  })
  frequency?: RecurringFrequency;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Moneda del fijo (ARS o USD). Opcional — default ARS.
   * La cotización es por mes de aparición: al editar con split, la fila nueva la hereda.
   * Fase 1.2.3.
   */
  @IsOptional()
  @IsEnum(Currency, { message: 'currency debe ser ARS, USD, EUR o BRL' })
  currency?: Currency;

  /**
   * Cotización ARS/1 USD al momento de creación del fijo. Opcional — default 1.
   * Número positivo con decimales. Fase 1.2.3.
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
   * no del método de pago. Solo relevante para fijos NORMALES; solo se persiste si
   * paymentMethodId apunta a un método de tipo DEBIT (queda null en cualquier otro caso).
   */
  @IsOptional()
  @IsBoolean({ message: 'autoDebit debe ser booleano' })
  autoDebit?: boolean;
}
