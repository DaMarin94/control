import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoryValidatorService } from '../categories/category-validator.service';
import {
  InstallmentsRepository,
  InstallmentGroupWithCategory,
} from './installments.repository';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';

@Injectable()
export class InstallmentsService {
  constructor(
    private readonly repo: InstallmentsRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly logger: Logger,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /installments — crear (RF-MC-001)
  // ---------------------------------------------------------------------------

  /**
   * Crea un grupo de cuotas.
   *
   * Solo acepta type EXPENSE en v1 (decisión cerrada D1).
   * Valida categoría: propia + activa + scope compatible EXPENSE (RN-010).
   * Valida semántica de startMonth (mes 01-12).
   *
   * @returns El grupo creado con categoría embebida.
   */
  async create(
    userId: string,
    dto: CreateInstallmentDto,
  ): Promise<InstallmentGroupWithCategory> {
    // Solo EXPENSE en v1 — rechazar INCOME explícitamente (decisión D1)
    if (dto.type !== MovementType.EXPENSE) {
      throw new BadRequestException(
        'Las cuotas solo admiten tipo EXPENSE en v1. INCOME en cuotas está fuera de alcance.',
      );
    }

    // Validar semántica del mes (el DTO ya valida el formato YYYY-MM con @Matches)
    this.validateMonthValue(dto.startMonth);

    // Validar categoría: propia + activa + scope compatible (RN-010)
    await this.categoryValidator.validateCategory(userId, dto.categoryId, dto.type);

    const group = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: dto.type,
      amountCents: dto.amountCents,
      totalInstallments: dto.totalInstallments,
      startMonth: dto.startMonth,
      description: dto.description ?? null,
    });

    this.logger.log(
      {
        userId,
        installmentGroupId: group.id,
        type: group.type,
        amountCents: group.amountCents,
        totalInstallments: group.totalInstallments,
        startMonth: group.startMonth,
      },
      'Grupo de cuotas creado',
    );

    return group;
  }

  // ---------------------------------------------------------------------------
  // PATCH /installments/:id — editar grupo completo (RF-MC-003)
  // ---------------------------------------------------------------------------

  /**
   * Edita el grupo de cuotas completo.
   *
   * La edición aplica al grupo entero (RF-MC-003): no hay split ni inmutabilidad
   * del pasado en cuotas (D2). Las cuotas se recalculan on-the-fly en /movements.
   *
   * type NO es editable (siempre EXPENSE en v1).
   * Si cambia categoryId, revalida scope contra EXPENSE (RN-010).
   * Si cambia startMonth, valida semántica del mes.
   *
   * @returns El grupo actualizado con categoría embebida.
   * @throws NotFoundException si no existe o no es del usuario.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateInstallmentDto,
  ): Promise<InstallmentGroupWithCategory> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Grupo de cuotas no encontrado');
    }

    // Validar semántica del nuevo startMonth si se provee
    if (dto.startMonth !== undefined) {
      this.validateMonthValue(dto.startMonth);
    }

    // Si cambia categoryId, revalidar scope contra type EXPENSE (siempre)
    if (dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(
        userId,
        dto.categoryId,
        MovementType.EXPENSE,
      );
    }

    const updated = await this.repo.update(id, {
      ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
      ...(dto.totalInstallments !== undefined && {
        totalInstallments: dto.totalInstallments,
      }),
      ...(dto.startMonth !== undefined && { startMonth: dto.startMonth }),
      ...(dto.categoryId !== undefined && {
        category: { connect: { id: dto.categoryId } },
      }),
      ...(dto.description !== undefined && { description: dto.description }),
    });

    this.logger.log(
      { userId, installmentGroupId: id },
      'Grupo de cuotas actualizado',
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // DELETE /installments/:id — hard delete del grupo completo (RF-MC-002)
  // ---------------------------------------------------------------------------

  /**
   * Elimina permanentemente el grupo de cuotas completo (RF-MC-002).
   *
   * Hard delete — no hay soft delete en cuotas. Elimina todas las instancias
   * (pasadas y futuras) ya que no existen filas individuales por instancia.
   *
   * @throws NotFoundException si no existe o no es del usuario.
   */
  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Grupo de cuotas no encontrado');
    }

    await this.repo.delete(id);

    this.logger.log(
      { userId, installmentGroupId: id },
      'Grupo de cuotas eliminado (hard delete)',
    );
  }

  // ---------------------------------------------------------------------------
  // Helper: validación de semántica del mes
  // ---------------------------------------------------------------------------

  /**
   * Valida que el número de mes esté entre 01 y 12.
   * Asume que el formato YYYY-MM ya pasó la validación del DTO (@Matches).
   */
  private validateMonthValue(month: string): void {
    const monthNum = parseInt(month.split('-')[1], 10);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('El mes debe estar entre 01 y 12');
    }
  }
}
