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
 * DTO para editar un método de pago (PATCH /payment-methods/:id, RF-PM-002).
 *
 * Todos los campos son opcionales. A diferencia de la categoría, el `type` de un
 * método de pago SÍ es editable tras crear: al cambiar de tipo, el service descarta
 * los campos condicionales que ya no aplican (closingDay/paymentDay). autoDebit NO
 * vive acá (corrección de alcance P4) — es un atributo del MOVIMIENTO.
 */
export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del método de pago no puede estar vacío' })
  name?: string;

  @IsOptional()
  @IsIn([...PAYMENT_METHOD_TYPES], {
    message: 'El tipo debe ser CREDIT, DEBIT o CASH',
  })
  type?: PaymentMethodType;

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
