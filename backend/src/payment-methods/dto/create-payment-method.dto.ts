import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PAYMENT_METHOD_TYPES, PaymentMethodType } from '../payment-method-constants';

/**
 * DTO para crear un método de pago (POST /payment-methods, RF-PM-001).
 *
 * Reglas de validación:
 * - name: obligatorio, no vacío.
 * - type: obligatorio, sin preselección — allowlist CREDIT | DEBIT | CASH (RN-021).
 * - icon: opcional. No se rechaza con 400 si no pertenece al set curado — el service
 *   la normaliza con fallback a "card" (RF-PM-004), a diferencia del color de categorías.
 * - closingDay / paymentDay: opcionales, enteros 1-31 (solo relevantes para CREDIT;
 *   el service descarta los que no aplican al tipo — RN-021). El clamp a fin de mes
 *   es informativo/de consumo, no se persiste otra cosa que 1-31.
 * - autoDebit NO es un campo del método de pago (corrección de alcance P4): es un
 *   atributo del MOVIMIENTO (Transaction/Recurring/InstallmentGroup). Ver sus DTOs.
 *
 * El userId NO se acepta en el body — se toma siempre de request.user.userId.
 */
export class CreatePaymentMethodDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del método de pago no puede estar vacío' })
  name!: string;

  @IsIn([...PAYMENT_METHOD_TYPES], {
    message: 'El tipo debe ser CREDIT, DEBIT o CASH',
  })
  type!: PaymentMethodType;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt({ message: 'El día de cierre debe ser un entero' })
  @Min(1, { message: 'El día de cierre debe estar entre 1 y 31' })
  @Max(31, { message: 'El día de cierre debe estar entre 1 y 31' })
  closingDay?: number;

  @IsOptional()
  @IsInt({ message: 'El día de cobro debe ser un entero' })
  @Min(1, { message: 'El día de cobro debe estar entre 1 y 31' })
  @Max(31, { message: 'El día de cobro debe estar entre 1 y 31' })
  paymentDay?: number;
}
