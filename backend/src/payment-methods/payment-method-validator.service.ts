import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PaymentMethodValidatorService — validador compartido de método de pago para movimientos.
 *
 * Espejo de CategoryValidatorService, pero sin validación de scope (el método de pago
 * no tiene restricción por tipo de movimiento — RF-PM-006). Lo inyectan los tres módulos
 * de movimientos (transactions, recurring, installments) para validar el `paymentMethodId`
 * opcional del body.
 *
 * Regla: el método debe ser propio del usuario (RN-003) y estar activo (deletedAt null).
 * Todos los errores son 400 BadRequest (validación de input, no conflicto). El método
 * ajeno NO se distingue de inexistente (no revela ajenidad).
 */
@Injectable()
export class PaymentMethodValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida que el método de pago (si fue provisto):
   * 1. Exista en la DB
   * 2. Pertenezca al userId (RN-003)
   * 3. Esté activo (deletedAt null)
   *
   * `paymentMethodId` es opcional (RF-PM-006): `undefined`/`null` no valida nada
   * (el movimiento simplemente no lleva método).
   *
   * @throws BadRequestException si el método no existe, es ajeno o está eliminado.
   */
  async validatePaymentMethod(
    userId: string,
    paymentMethodId: string | null | undefined,
  ): Promise<void> {
    if (paymentMethodId === undefined || paymentMethodId === null) {
      return;
    }

    const method = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
      select: { id: true, userId: true, deletedAt: true },
    });

    if (!method || method.userId !== userId) {
      throw new BadRequestException(
        'El método de pago no existe o no pertenece al usuario',
      );
    }

    if (method.deletedAt !== null) {
      throw new BadRequestException('El método de pago está eliminado');
    }
  }

  /**
   * Resuelve el valor efectivo de `autoDebit` a persistir en un movimiento
   * (P4 — corrección de alcance: autoDebit es un atributo del MOVIMIENTO, no del
   * método de pago).
   *
   * autoDebit solo es persistible cuando el movimiento tiene un método de pago
   * asociado de tipo DEBIT. En cualquier otro caso (sin método, o método de otro
   * tipo) se fuerza a `null` — no se persiste `true` "huérfano".
   *
   * No valida ownership/estado del método (eso es responsabilidad de
   * `validatePaymentMethod`, ya llamado por el caller cuando `paymentMethodId`
   * cambia); esta función solo mira el `type` para decidir si autoDebit aplica.
   *
   * @param paymentMethodId id EFECTIVO del método de pago del movimiento (el que
   *   quedará asociado tras el create/update), o null si no tiene método.
   * @param requestedAutoDebit valor pedido (del DTO, o heredado del existing si
   *   el DTO no lo tocó); null si no se pidió nada.
   */
  async resolveAutoDebit(
    paymentMethodId: string | null,
    requestedAutoDebit: boolean | null,
  ): Promise<boolean | null> {
    if (!paymentMethodId) return null;

    const method = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
      select: { type: true },
    });

    if (!method || method.type !== 'DEBIT') return null;

    return requestedAutoDebit;
  }
}
