import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoryValidatorService } from '../categories/category-validator.service';
import {
  TransactionsRepository,
  TransactionWithCategory,
} from './transactions.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionsRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /transactions — crear (RF-MU-001)
  // ---------------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionWithCategory> {
    // Validar categoría: propia + activa + scope compatible (RN-010)
    await this.categoryValidator.validateCategory(userId, dto.categoryId, dto.type);

    const effectiveExchangeRate = dto.exchangeRate ?? 1;

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

    // Determinar type y categoryId resultantes para revalidar RN-010
    const effectiveType = dto.type ?? existing.type;
    const effectiveCategoryId = dto.categoryId ?? existing.categoryId;

    // Si cambió el type o la categoría, revalidar scope compatibility (RN-010)
    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, effectiveCategoryId, effectiveType);
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
    });

    // Actualizar lastExchangeRate del usuario si se editó la cotización
    if (dto.exchangeRate !== undefined) {
      await this.settingsService.updateLastExchangeRate(userId, dto.exchangeRate);
    }

    this.logger.log(
      { userId, transactionId: id },
      'Transacción actualizada',
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // DELETE /transactions/:id — hard delete (RF-MU-003)
  // ---------------------------------------------------------------------------

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Transacción no encontrada');
    }

    await this.repo.delete(id);

    this.logger.log(
      { userId, transactionId: id },
      'Transacción eliminada (hard delete)',
    );
  }

}
