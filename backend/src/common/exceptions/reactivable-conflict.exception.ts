import { ConflictException } from '@nestjs/common';

/**
 * Excepción especial para el caso de colisión con un recurso soft-deleted homónimo
 * (categoría — RF-CAT-002, A3; método de pago — RF-PM-001, A4).
 *
 * Extiende ConflictException (409) e incorpora un payload estructurado que el
 * AllExceptionsFilter detecta para incluirlo en el campo `data` del sobre de error.
 *
 * Shape de respuesta resultante (dentro del sobre de error), categoría:
 * {
 *   success: false,
 *   statusCode: 409,
 *   error: {
 *     message: "...",
 *     timestamp: "...",
 *     path: "...",
 *     data: { reactivable: true, category: { id, name, scope, color } }
 *   }
 * }
 *
 * El frontend usa el campo `data.category.id` / `data.paymentMethod.id` para llamar
 * a POST /categories/:id/reactivate o POST /payment-methods/:id/reactivate.
 */
export interface ReactivableCategoryPayload {
  reactivable: true;
  category: {
    id: string;
    name: string;
    scope: string;
    color: string;
  };
}

export interface ReactivablePaymentMethodPayload {
  reactivable: true;
  paymentMethod: {
    id: string;
    name: string;
    type: string;
    icon: string;
  };
}

export type ReactivablePayload =
  | ReactivableCategoryPayload
  | ReactivablePaymentMethodPayload;

/**
 * Genérica sobre el payload concreto (default `ReactivableCategoryPayload`, el caso
 * histórico) para que cada call-site conserve el tipo específico sin necesitar un
 * narrowing manual del union al leer `reactivablePayload` (categorías vs métodos de pago).
 */
export class ReactivableConflictException<
  T extends ReactivablePayload = ReactivableCategoryPayload,
> extends ConflictException {
  constructor(
    message: string,
    public readonly reactivablePayload: T,
  ) {
    super(message);
  }
}
