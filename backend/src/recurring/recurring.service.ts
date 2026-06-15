import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoryValidatorService } from '../categories/category-validator.service';
import {
  RecurringRepository,
  RecurringWithCategory,
} from './recurring.repository';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';

@Injectable()
export class RecurringService {
  constructor(
    private readonly repo: RecurringRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly logger: Logger,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /recurring — crear (RF-MF-001)
  // ---------------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreateRecurringDto,
  ): Promise<RecurringWithCategory> {
    // Validar mes semántico de startMonth
    this.validateMonthValue(dto.startMonth);

    // Validar categoría: propia + activa + scope compatible (RN-010)
    await this.categoryValidator.validateCategory(userId, dto.categoryId, dto.type);

    const r = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: dto.type,
      amountCents: dto.amountCents,
      startMonth: dto.startMonth,
      description: dto.description ?? null,
    });

    this.logger.log(
      {
        userId,
        recurringId: r.id,
        type: r.type,
        amountCents: r.amountCents,
        startMonth: r.startMonth,
      },
      'Movimiento fijo creado',
    );

    return r;
  }

  // ---------------------------------------------------------------------------
  // PATCH /recurring/:id — editar con lógica de split (RF-MF-003, D1)
  // ---------------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringDto,
  ): Promise<RecurringWithCategory> {
    // Validar mes semántico de currentMonth
    this.validateMonthValue(dto.currentMonth);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento fijo no encontrado');
    }

    // Si cambia categoryId, revalidar scope contra el type vigente (que NO cambia — D1)
    if (dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, dto.categoryId, existing.type);
    }

    // Lógica de split (D1):
    // Si currentMonth > R.startMonth → hay pasado: split
    // Si currentMonth <= R.startMonth → sin pasado: update in-place
    let result: RecurringWithCategory;

    if (dto.currentMonth > existing.startMonth) {
      // SPLIT: guardar pasado hasta currentMonth, crear nueva fila desde currentMonth
      // 1. Marcar la fila existente con deletedFrom = currentMonth (la "cierra" en el pasado)
      await this.repo.update(id, { deletedFrom: dto.currentMonth });

      // 2. Crear la nueva fila R2 con los valores nuevos (type NO cambia)
      result = await this.repo.create({
        user: { connect: { id: userId } },
        category: { connect: { id: dto.categoryId ?? existing.categoryId } },
        type: existing.type, // type es inmutable (RF-MF-003)
        amountCents: dto.amountCents ?? existing.amountCents,
        startMonth: dto.currentMonth,
        deletedFrom: existing.deletedFrom,
        description: dto.description !== undefined
          ? dto.description
          : existing.description,
      });

      this.logger.log(
        {
          userId,
          originalId: id,
          newId: result.id,
          currentMonth: dto.currentMonth,
          splitType: 'split',
        },
        'Movimiento fijo editado (split — preserva pasado)',
      );
    } else {
      // UPDATE IN-PLACE: currentMonth <= startMonth, no hay meses pasados
      result = await this.repo.update(id, {
        ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
        ...(dto.categoryId !== undefined && {
          category: { connect: { id: dto.categoryId } },
        }),
        // description: actualizar si se incluye en el body (puede ser null para limpiarla)
        ...(dto.description !== undefined && { description: dto.description }),
      });

      this.logger.log(
        {
          userId,
          recurringId: id,
          currentMonth: dto.currentMonth,
          splitType: 'in-place',
        },
        'Movimiento fijo editado (in-place)',
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // DELETE /recurring/:id — soft-set deletedFrom o hard-delete (RF-MF-004, D2)
  // ---------------------------------------------------------------------------

  /**
   * Elimina (o marca para eliminar) un fijo.
   *
   * Lógica (D2):
   * - boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)
   * - Si boundary <= R.startMonth → la fila aparecería en 0 meses → hard delete
   * - Si no → set R.deletedFrom = boundary
   *
   * Nunca toca filas que representan el pasado.
   * 404 si no existe o no es del usuario.
   */
  async remove(
    userId: string,
    id: string,
    currentMonth: string,
    fromCurrentMonth: boolean,
  ): Promise<void> {
    // Validar formato y semántica del mes
    this.validateMonthFormat(currentMonth);
    this.validateMonthValue(currentMonth);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento fijo no encontrado');
    }

    const boundary = fromCurrentMonth
      ? currentMonth
      : this.nextMonth(currentMonth);

    if (boundary <= existing.startMonth) {
      // Hard delete: el fijo nunca habría aparecido en ningún mes
      await this.repo.delete(id);

      this.logger.log(
        { userId, recurringId: id, boundary, deleteType: 'hard' },
        'Movimiento fijo eliminado (hard delete — boundary <= startMonth)',
      );
    } else {
      // Soft-set deletedFrom = boundary
      await this.repo.update(id, { deletedFrom: boundary });

      this.logger.log(
        { userId, recurringId: id, boundary, deleteType: 'soft' },
        'Movimiento fijo eliminado (set deletedFrom)',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: validación de formato de mes
  // ---------------------------------------------------------------------------

  /**
   * Valida que el string tenga formato YYYY-MM.
   * (La regex del DTO ya lo garantiza para los campos de DTO, pero el query param
   * de DELETE llega como string sin decorators de clase.)
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
   * Asume que el formato ya pasó validateMonthFormat o la regex del DTO.
   */
  private validateMonthValue(month: string): void {
    const monthNum = parseInt(month.split('-')[1], 10);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('El mes debe estar entre 01 y 12');
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: mes siguiente con rollover de año
  // ---------------------------------------------------------------------------

  /**
   * Calcula el mes siguiente a un YYYY-MM dado, con rollover de año.
   * Ejemplo: '2026-12' → '2027-01', '2026-06' → '2026-07'.
   */
  nextMonth(month: string): string {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    let nextYear = year;
    let nextMonthNum = monthNum + 1;
    if (nextMonthNum > 12) {
      nextMonthNum = 1;
      nextYear = year + 1;
    }

    return `${nextYear}-${String(nextMonthNum).padStart(2, '0')}`;
  }
}
