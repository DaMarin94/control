import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoryValidatorService } from '../categories/category-validator.service';
import { PaymentMethodValidatorService } from '../payment-methods/payment-method-validator.service';
import {
  InstallmentsRepository,
  InstallmentGroupWithCategory,
  SkipToggleResult,
} from './installments.repository';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class InstallmentsService {
  constructor(
    private readonly repo: InstallmentsRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly paymentMethodValidator: PaymentMethodValidatorService,
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
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

    // Validar método de pago (opcional): propio + activo (RF-PM-006)
    await this.paymentMethodValidator.validatePaymentMethod(userId, dto.paymentMethodId);

    const effectiveExchangeRate = dto.exchangeRate ?? 1;

    // Cargar la defaultCurrency del usuario para anclarla como anchor (Fase 1.2.4)
    const userSettings = await this.settingsService.getSettings(userId);
    const anchorCurrency = userSettings.defaultCurrency;

    // autoDebit (P4 — corrección de alcance): solo se persiste si el método asociado
    // es de tipo DEBIT; en cualquier otro caso queda null.
    const autoDebit = await this.paymentMethodValidator.resolveAutoDebit(
      dto.paymentMethodId ?? null,
      dto.autoDebit ?? null,
    );

    const group = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: dto.type,
      amountCents: dto.amountCents,
      totalInstallments: dto.totalInstallments,
      startMonth: dto.startMonth,
      description: dto.description ?? null,
      ...(dto.currency !== undefined && { currency: dto.currency }),
      exchangeRate: effectiveExchangeRate,
      anchorCurrency,
      ...(dto.paymentMethodId !== undefined && {
        paymentMethod: { connect: { id: dto.paymentMethodId } },
      }),
      autoDebit,
    });

    await this.settingsService.updateLastExchangeRate(userId, effectiveExchangeRate);

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

    // Validar método de pago si se está actualizando (null = desasociar, no valida)
    if (dto.paymentMethodId !== undefined) {
      await this.paymentMethodValidator.validatePaymentMethod(userId, dto.paymentMethodId);
    }

    // Si se actualiza la cotización o moneda, actualizar el anchor (Fase 1.2.4)
    let updateAnchor: Currency | undefined = undefined;
    if (dto.exchangeRate !== undefined || dto.currency !== undefined) {
      const s = await this.settingsService.getSettings(userId);
      updateAnchor = s.defaultCurrency;
    }

    // autoDebit (P4 — corrección de alcance): recalcular solo si paymentMethodId o
    // autoDebit vienen en el body; en cualquier otro PATCH se deja intacto.
    let autoDebit: boolean | null | undefined = undefined;
    if (dto.paymentMethodId !== undefined || dto.autoDebit !== undefined) {
      const effectivePaymentMethodId =
        dto.paymentMethodId !== undefined ? dto.paymentMethodId : existing.paymentMethodId;
      const effectiveRequestedAutoDebit =
        dto.autoDebit !== undefined ? dto.autoDebit : existing.autoDebit;
      autoDebit = await this.paymentMethodValidator.resolveAutoDebit(
        effectivePaymentMethodId,
        effectiveRequestedAutoDebit,
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
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.exchangeRate !== undefined && { exchangeRate: dto.exchangeRate }),
      ...(updateAnchor !== undefined && { anchorCurrency: updateAnchor }),
      ...(dto.paymentMethodId !== undefined && {
        paymentMethod:
          dto.paymentMethodId === null
            ? { disconnect: true }
            : { connect: { id: dto.paymentMethodId } },
      }),
      ...(autoDebit !== undefined && { autoDebit }),
    });

    if (dto.exchangeRate !== undefined) {
      await this.settingsService.updateLastExchangeRate(userId, dto.exchangeRate);
    }

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
  // POST /installments/:id/skip — toggle anular/des-anular (P3 — Fase 1.1.1.ext)
  // ---------------------------------------------------------------------------

  /**
   * Toglea el skip de una cuota puntual de un grupo, para un mes puntual.
   * Espejo exacto de RecurringService.toggleSkip (P1).
   *
   * - Si (grupo, mes) ya está skippeado → lo des-anula (borra el skip).
   * - Si no → lo anula (crea el skip).
   * Anula SOLO la instancia de ese mes, no el grupo entero.
   * Devuelve { skipped, month } con el estado resultante.
   *
   * 404 si el grupo no existe o no pertenece al usuario (RN-003).
   * 400 si el formato del mes es inválido.
   *
   * NOTA: no se valida que el mes caiga dentro del rango del grupo (startMonth..
   * startMonth+totalInstallments). Esa validación semántica es responsabilidad
   * del frontend (que ya tiene el ítem del mes desde GET /movements). El backend
   * solo valida formato y ownership.
   */
  async toggleSkip(
    userId: string,
    id: string,
    month: string,
  ): Promise<SkipToggleResult> {
    this.validateMonthFormat(month);
    this.validateMonthValue(month);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Grupo de cuotas no encontrado');
    }

    const alreadySkipped = await this.repo.findSkip(id, month);

    if (alreadySkipped) {
      await this.repo.deleteSkip(id, month);

      this.logger.log(
        { userId, installmentGroupId: id, month, action: 'unskip' },
        'Cuota des-anulada para el mes',
      );

      return { skipped: false, month };
    } else {
      await this.repo.createSkip(id, month);

      this.logger.log(
        { userId, installmentGroupId: id, month, action: 'skip' },
        'Cuota anulada para el mes',
      );

      return { skipped: true, month };
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: validación de semántica del mes
  // ---------------------------------------------------------------------------

  /**
   * Valida que el string tenga formato YYYY-MM.
   */
  private validateMonthFormat(month: string): void {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El mes debe tener formato YYYY-MM (ej: 2026-06)',
      );
    }
  }

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
