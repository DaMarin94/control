import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import {
  PaymentMethodsRepository,
  PaymentMethodWithCount,
  normalizePaymentMethodName,
} from './payment-methods.repository';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { normalizePaymentMethodIcon } from './payment-method-constants';
import {
  ReactivableConflictException,
  ReactivablePaymentMethodPayload,
} from '../common/exceptions/reactivable-conflict.exception';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly repo: PaymentMethodsRepository,
    private readonly logger: Logger,
  ) {}

  // -------------------------------------------------------------------------
  // GET /payment-methods — lista activos con contador de movimientos
  // -------------------------------------------------------------------------

  async findAll(userId: string): Promise<PaymentMethodWithCount[]> {
    const methods = await this.repo.findActiveByUser(userId);
    this.logger.debug(
      { userId, count: methods.length },
      'Métodos de pago listados',
    );
    return methods;
  }

  // -------------------------------------------------------------------------
  // POST /payment-methods — crear (flujo crear-o-reactivar, RF-PM-001)
  // -------------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodWithCount> {
    // 1. Normalizar nombre (RN-014)
    const normalizedInput = normalizePaymentMethodName(dto.name);

    if (!normalizedInput) {
      throw new ConflictException(
        'El nombre del método de pago no puede estar vacío',
      );
    }

    // 2. Buscar colisiones (activo y eliminado)
    const { active, deleted } = await this.repo.findByNormalizedName(
      userId,
      normalizedInput,
    );

    // 3a. Colisión con activo → 409 duplicado (espejo RN-008)
    if (active) {
      this.logger.warn(
        { userId, name: dto.name },
        'Intento de crear método de pago duplicado (activo)',
      );
      throw new ConflictException(
        `Ya existe un método de pago activo con el nombre "${active.name}"`,
      );
    }

    // 3b. Colisión con eliminado → 409 reactivable (RF-PM-001, A4)
    if (deleted) {
      this.logger.warn(
        { userId, name: dto.name, deletedPaymentMethodId: deleted.id },
        'Intento de crear método de pago con nombre de uno eliminado — reactivable',
      );
      const payload: ReactivablePaymentMethodPayload = {
        reactivable: true,
        paymentMethod: {
          id: deleted.id,
          name: deleted.name,
          type: deleted.type,
          icon: deleted.icon,
        },
      };
      throw new ReactivableConflictException(
        `Ya tenés un método de pago eliminado con el nombre "${deleted.name}". Podés reactivarlo.`,
        payload,
      );
    }

    // 4. Sin colisión → resolver ícono y campos condicionales por tipo (RN-021)
    const icon = normalizePaymentMethodIcon(dto.icon);
    const conditional = this.resolveConditionalFields(dto.type, dto);

    const method = await this.repo.create({
      user: { connect: { id: userId } },
      name: dto.name,
      type: dto.type,
      icon,
      closingDay: conditional.closingDay,
      paymentDay: conditional.paymentDay,
    });

    this.logger.log(
      { userId, paymentMethodId: method.id, type: method.type },
      'Método de pago creado',
    );

    return method;
  }

  // -------------------------------------------------------------------------
  // POST /payment-methods/:id/reactivate — reactivar (RF-PM-001, A4)
  // -------------------------------------------------------------------------

  async reactivate(
    userId: string,
    id: string,
  ): Promise<PaymentMethodWithCount> {
    const method = await this.repo.findById(id);

    if (!method || method.userId !== userId) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    if (method.deletedAt === null) {
      throw new ConflictException('El método de pago ya está activo');
    }

    const reactivated = await this.repo.update(id, { deletedAt: null });

    this.logger.log(
      { userId, paymentMethodId: id },
      'Método de pago reactivado',
    );

    return reactivated;
  }

  // -------------------------------------------------------------------------
  // PATCH /payment-methods/:id — editar (RF-PM-002)
  // -------------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodWithCount> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    if (existing.deletedAt !== null) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    // Revalidar unicidad si el nombre cambia (RN-014)
    if (dto.name !== undefined) {
      const normalizedInput = normalizePaymentMethodName(dto.name);

      if (!normalizedInput) {
        throw new ConflictException(
          'El nombre del método de pago no puede estar vacío',
        );
      }

      const activeExcluding = await this.repo.findActiveExcluding(userId, id);
      const collision = activeExcluding.find(
        (pm) => normalizePaymentMethodName(pm.name) === normalizedInput,
      );

      if (collision) {
        this.logger.warn(
          { userId, paymentMethodId: id, name: dto.name },
          'Edición: colisión de nombre con método de pago activo',
        );
        throw new ConflictException(
          `Ya existe un método de pago activo con el nombre "${collision.name}"`,
        );
      }
    }

    // Campos condicionales por tipo (RF-PM-002): si el tipo cambia, se descartan
    // los que ya no aplican; si no cambia, solo se tocan los presentes en el DTO.
    const effectiveType = dto.type ?? existing.type;
    const typeChanged = dto.type !== undefined && dto.type !== existing.type;

    let closingDay: number | null | undefined;
    let paymentDay: number | null | undefined;

    if (typeChanged) {
      const conditional = this.resolveConditionalFields(effectiveType, dto);
      closingDay = conditional.closingDay;
      paymentDay = conditional.paymentDay;
    } else {
      if (dto.closingDay !== undefined) {
        closingDay = effectiveType === 'CREDIT' ? dto.closingDay : null;
      }
      if (dto.paymentDay !== undefined) {
        paymentDay = effectiveType === 'CREDIT' ? dto.paymentDay : null;
      }
    }

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.icon !== undefined && { icon: normalizePaymentMethodIcon(dto.icon) }),
      ...(closingDay !== undefined && { closingDay }),
      ...(paymentDay !== undefined && { paymentDay }),
    });

    this.logger.log(
      { userId, paymentMethodId: id },
      'Método de pago actualizado',
    );

    return updated;
  }

  // -------------------------------------------------------------------------
  // DELETE /payment-methods/:id — soft delete (RF-PM-003)
  // -------------------------------------------------------------------------

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    if (existing.deletedAt !== null) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    await this.repo.update(id, { deletedAt: new Date() });

    this.logger.log(
      { userId, paymentMethodId: id },
      'Método de pago eliminado (soft delete)',
    );
  }

  // -------------------------------------------------------------------------
  // Helper privado: campos condicionales por tipo (RN-021)
  // -------------------------------------------------------------------------

  /**
   * Resuelve closingDay/paymentDay para un tipo dado, tomando los valores del
   * DTO solo si aplican al tipo (CREDIT); el resto queda en null.
   */
  private resolveConditionalFields(
    type: string,
    dto: { closingDay?: number; paymentDay?: number },
  ): {
    closingDay: number | null;
    paymentDay: number | null;
  } {
    return {
      closingDay: type === 'CREDIT' ? (dto.closingDay ?? null) : null,
      paymentDay: type === 'CREDIT' ? (dto.paymentDay ?? null) : null,
    };
  }
}
