import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, HistoryAction, HistoryTargetKind, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoryValidatorService } from '../categories/category-validator.service';
import { PaymentMethodValidatorService } from '../payment-methods/payment-method-validator.service';
import {
  TransactionsRepository,
  TransactionWithCategory,
} from './transactions.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { SettingsService } from '../settings/settings.service';
import { HistoryService } from '../history/history.service';
import { UnicoSnapshot } from '../history/history.types';
import { RecurringService } from '../recurring/recurring.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionsRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly paymentMethodValidator: PaymentMethodValidatorService,
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
    private readonly historyService: HistoryService,
    private readonly recurringService: RecurringService,
  ) {}

  /** Snapshot completo del único, para historial (RF-HIST-001). */
  private buildSnapshot(tx: TransactionWithCategory): UnicoSnapshot {
    return {
      type: tx.type,
      amountCents: tx.amountCents,
      categoryId: tx.categoryId,
      description: tx.description,
      occurredAt: tx.occurredAt.toISOString(),
      timezone: tx.timezone,
      currency: tx.currency,
      exchangeRate: tx.exchangeRate,
      anchorCurrency: tx.anchorCurrency,
      paymentMethodId: tx.paymentMethodId,
      autoDebit: tx.autoDebit,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /transactions — crear (RF-MU-001)
  // ---------------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionWithCategory> {
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

    const tx = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: dto.type,
      amountCents: dto.amountCents,
      occurredAt: new Date(dto.occurredAt),
      timezone: dto.timezone,
      description: dto.description ?? null,
      ...(dto.currency !== undefined && { currency: dto.currency }),
      exchangeRate: effectiveExchangeRate,
      anchorCurrency,
      ...(dto.paymentMethodId !== undefined && {
        paymentMethod: { connect: { id: dto.paymentMethodId } },
      }),
      autoDebit,
    });

    // Actualizar lastExchangeRate del usuario (solo si no es el default de back-compat)
    await this.settingsService.updateLastExchangeRate(userId, effectiveExchangeRate);

    this.logger.log(
      { userId, transactionId: tx.id, type: tx.type, amountCents: tx.amountCents },
      'Transacción creada',
    );

    return tx;
  }

  // ---------------------------------------------------------------------------
  // GET /transactions/:id — obtener una por id
  // ---------------------------------------------------------------------------

  async findOne(userId: string, id: string): Promise<TransactionWithCategory> {
    const tx = await this.repo.findById(id);

    if (!tx || tx.userId !== userId) {
      throw new NotFoundException('Transacción no encontrada');
    }

    return tx;
  }

  // ---------------------------------------------------------------------------
  // PATCH /transactions/:id — editar (RF-MU-002)
  // ---------------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionWithCategory> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Transacción no encontrada');
    }

    // Snapshot del estado previo, ANTES de mutar (RF-HIST-001).
    const snapshot = this.buildSnapshot(existing);

    // Determinar type y categoryId resultantes para revalidar RN-010
    const effectiveType = dto.type ?? existing.type;
    const effectiveCategoryId = dto.categoryId ?? existing.categoryId;

    // Si cambió el type o la categoría, revalidar scope compatibility (RN-010)
    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, effectiveCategoryId, effectiveType);
    }

    // Validar método de pago si se está actualizando (null = desasociar, no valida)
    if (dto.paymentMethodId !== undefined) {
      await this.paymentMethodValidator.validatePaymentMethod(userId, dto.paymentMethodId);
    }

    // Si se está actualizando la cotización, también actualizar el anchor (Fase 1.2.4)
    let anchorCurrency: Currency | undefined = undefined;
    if (dto.exchangeRate !== undefined || dto.currency !== undefined) {
      const userSettings = await this.settingsService.getSettings(userId);
      anchorCurrency = userSettings.defaultCurrency;
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
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
      ...(dto.categoryId !== undefined && {
        category: { connect: { id: dto.categoryId } },
      }),
      ...(dto.occurredAt !== undefined && {
        occurredAt: new Date(dto.occurredAt),
      }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      // description: permitir limpiarla a null enviando null, o actualizarla si viene en el body
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.exchangeRate !== undefined && { exchangeRate: dto.exchangeRate }),
      ...(anchorCurrency !== undefined && { anchorCurrency }),
      ...(dto.paymentMethodId !== undefined && {
        paymentMethod:
          dto.paymentMethodId === null
            ? { disconnect: true }
            : { connect: { id: dto.paymentMethodId } },
      }),
      ...(autoDebit !== undefined && { autoDebit }),
    });

    // Actualizar lastExchangeRate del usuario si se editó la cotización
    if (dto.exchangeRate !== undefined) {
      await this.settingsService.updateLastExchangeRate(userId, dto.exchangeRate);
    }

    await this.historyService.record(
      userId,
      HistoryTargetKind.UNICO,
      id,
      HistoryAction.EDIT,
      snapshot,
    );

    this.logger.log(
      { userId, transactionId: id },
      'Transacción actualizada',
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // DELETE /transactions/:id — borrado lógico (RF-MU-003, RF-HIST-006)
  // ---------------------------------------------------------------------------

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Transacción no encontrada');
    }

    // Snapshot del estado previo, ANTES de marcar como eliminado (RF-HIST-001).
    const snapshot = this.buildSnapshot(existing);

    await this.repo.softDelete(id);

    // Cascada lógica a los calculados de único (RN-024/026): nunca se borran
    // físicamente mientras la entrada de historial del origen esté vigente.
    await this.recurringService.cascadeSoftDeleteBySourceMovement(userId, id);

    await this.historyService.record(
      userId,
      HistoryTargetKind.UNICO,
      id,
      HistoryAction.DELETE,
      snapshot,
    );

    this.logger.log(
      { userId, transactionId: id },
      'Transacción eliminada (borrado lógico)',
    );
  }

  // ---------------------------------------------------------------------------
  // POST /transactions/:id/skip — toggle anular/des-anular (P3 — Fase 1.1.1.ext)
  // ---------------------------------------------------------------------------

  /**
   * Toglea la anulación (skip) de un único.
   *
   * A diferencia de fijos y cuotas, el único es UNA sola fila (sin noción de mes):
   * el skip es directamente el flag booleano `skipped` en la fila. Toggle simple:
   * invierte el valor actual.
   *
   * 404 si la transacción no existe o no pertenece al usuario (RN-003).
   */
  async toggleSkip(userId: string, id: string): Promise<{ skipped: boolean }> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Transacción no encontrada');
    }

    const newSkipped = !existing.skipped;

    await this.repo.update(id, { skipped: newSkipped });

    this.logger.log(
      { userId, transactionId: id, skipped: newSkipped },
      newSkipped ? 'Único anulado' : 'Único des-anulado',
    );

    return { skipped: newSkipped };
  }
}
