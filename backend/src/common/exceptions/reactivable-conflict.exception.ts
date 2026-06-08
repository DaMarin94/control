import { ConflictException } from '@nestjs/common';

/**
 * Excepción especial para el caso de colisión con una categoría ELIMINADA (RF-CAT-002, A3).
 *
 * Extiende ConflictException (409) e incorpora un payload estructurado que el
 * AllExceptionsFilter detecta para incluirlo en el campo `data` del sobre de error.
 *
 * Shape de respuesta resultante (dentro del sobre de error):
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
 * El frontend usa el campo `data.category.id` para llamar a POST /categories/:id/reactivate.
 */
export interface ReactivablePayload {
  reactivable: true;
  category: {
    id: string;
    name: string;
    scope: string;
    color: string;
  };
}

export class ReactivableConflictException extends ConflictException {
  constructor(
    message: string,
    public readonly reactivablePayload: ReactivablePayload,
  ) {
    super(message);
  }
}
