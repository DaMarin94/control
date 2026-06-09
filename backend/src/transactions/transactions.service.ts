import {
  BadRequestException,
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

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionsRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly logger: Logger,
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

    const tx = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: dto.type,
      amountCents: dto.amountCents,
      occurredAt: new Date(dto.occurredAt),
      timezone: dto.timezone,
      description: dto.description ?? null,
    });

    this.logger.log(
      { userId, transactionId: tx.id, type: tx.type, amountCents: tx.amountCents },
      'Transacción creada',
    );

    return tx;
  }

  // ---------------------------------------------------------------------------
  // GET /transactions?month=YYYY-MM — listar por mes
  // ---------------------------------------------------------------------------

  /**
   * Lista las transacciones del usuario que caen en el mes YYYY-MM.
   *
   * Criterio de bucketeo por mes:
   * Se calcula el rango UTC correspondiente al mes YYYY-MM en la timezone
   * recibida como parámetro (timezone del perfil del usuario, o la timezone
   * que el front conoce como "mes actual"). El rango es [inicio_mes_en_UTC, fin_mes_en_UTC).
   *
   * Ejemplo: mes "2026-06" en "America/Argentina/Buenos_Aires" (UTC-3):
   *   - inicio = 2026-06-01T00:00:00-03:00 → 2026-06-01T03:00:00Z
   *   - fin    = 2026-07-01T00:00:00-03:00 → 2026-07-01T03:00:00Z
   *
   * Limitación conocida (documentada):
   * Este criterio bucketea en la timezone del PERFIL del usuario (o la que el
   * front mande). Si una transacción se cargó en una timezone diferente a la
   * del perfil (ej: el usuario estaba de viaje), podría aparecer en el mes
   * "equivocado" para el bucketeo del perfil. En v1 este es un trade-off
   * aceptable por simplicidad. La alternativa (bucketear en la timezone propia
   * de cada registro via SQL AT TIME ZONE) requeriría SQL crudo y complejidad
   * adicional en Prisma 7.
   *
   * Si month no se pasa → error 400 (es obligatorio para no asumir timezone server-side).
   */
  async findByMonth(
    userId: string,
    month: string,
    userTimezone: string,
  ): Promise<TransactionWithCategory[]> {
    const { from, to } = this.parseMonthToUtcRange(month, userTimezone);

    const txs = await this.repo.findByUserAndDateRange(userId, from, to);

    this.logger.debug(
      { userId, month, count: txs.length },
      'Transacciones listadas por mes',
    );

    return txs;
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
    });

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

  // ---------------------------------------------------------------------------
  // Helper privado: parseo de mes YYYY-MM a rango UTC
  // ---------------------------------------------------------------------------

  /**
   * Convierte un mes "YYYY-MM" y una timezone IANA a un rango de fechas UTC.
   *
   * Estrategia: usa Intl.DateTimeFormat para encontrar el offset UTC de la zona
   * en la medianoche del primer día del mes, luego calcula el rango UTC
   * [inicio_mes_local_en_UTC, inicio_mes_siguiente_en_UTC).
   *
   * Esto es correcto para zonas con DST porque usa el offset real de ese día,
   * no un offset fijo. En zonas sin DST (como America/Argentina/Buenos_Aires)
   * siempre es -03:00.
   */
  parseMonthToUtcRange(
    month: string,
    timezone: string,
  ): { from: Date; to: Date } {
    // Validar formato YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El parámetro month debe tener formato YYYY-MM (ej: 2026-06)',
      );
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('El mes debe estar entre 01 y 12');
    }

    // Calcular el mes siguiente
    let nextYear = year;
    let nextMonth = monthNum + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }

    // Convertir la medianoche local de inicio y fin del mes a UTC
    const from = this.localMidnightToUtc(year, monthNum, 1, timezone);
    const to = this.localMidnightToUtc(nextYear, nextMonth, 1, timezone);

    return { from, to };
  }

  /**
   * Convierte la medianoche local de una fecha (año, mes, día) en la timezone dada a UTC.
   *
   * Técnica: construye la fecha como si fuera UTC medianoche, luego usa
   * Intl.DateTimeFormat para detectar el offset real de esa zona en ese instante,
   * y ajusta. Esto maneja DST correctamente.
   */
  private localMidnightToUtc(
    year: number,
    month: number,
    day: number,
    timezone: string,
  ): Date {
    // Intentar parsear la timezone — si es inválida, Intl.DateTimeFormat lanza
    try {
      // Construimos un instante UTC tentativo y lo ajustamos iterativamente
      // Primer intento: asumimos que UTC medianoche es un buen punto de partida
      const candidate = new Date(
        Date.UTC(year, month - 1, day, 0, 0, 0, 0),
      );

      // Obtener la representación local de ese instante en la timezone dada
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(candidate);

      const get = (type: string) =>
        parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

      const localYear = get('year');
      const localMonth = get('month');
      const localDay = get('day');
      const localHour = get('hour');
      const localMinute = get('minute');
      const localSecond = get('second');

      // Diferencia en ms entre lo que queríamos (medianoche local) y lo que obtenemos
      // La medianoche local de (year, month, day) en timezone es el instante UTC
      // candidate + (medianoche - hora local del candidate)
      const wantedLocalMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
      const actualLocalMs = Date.UTC(
        localYear,
        localMonth - 1,
        localDay,
        localHour === 24 ? 0 : localHour,
        localMinute,
        localSecond,
      );

      const offsetMs = wantedLocalMs - actualLocalMs;
      return new Date(candidate.getTime() + offsetMs);
    } catch {
      throw new BadRequestException(
        `La timezone "${timezone}" no es válida`,
      );
    }
  }
}
