import { Injectable } from '@nestjs/common';
import { MovementType, RecurringFrequency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape de categoría embebida en un Recurring.
 * Se incluye siempre para que el frontend pueda mostrarla sin request adicional.
 */
export interface EmbeddedCategory {
  id: string;
  name: string;
  color: string;
  scope: string;
}

/**
 * Shape completo de un fijo con categoría embebida.
 * Incluye frequency (P2 — Fase 1.1.1) y skippedMonths (P1).
 */
export interface RecurringWithCategory {
  id: string;
  userId: string;
  categoryId: string;
  type: MovementType;
  amountCents: number;
  description: string | null;
  startMonth: string;
  deletedFrom: string | null;
  frequency: RecurringFrequency;
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
}

/**
 * Resultado del toggle de skip (P1 — Fase 1.1.1).
 * - skipped: true si el mes quedó anulado (se creó el skip); false si fue des-anulado (se borró).
 * - month: mes que fue toggleado.
 */
export interface SkipToggleResult {
  skipped: boolean;
  month: string;
}

// Include para todas las queries de Recurring
const RECURRING_INCLUDE = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      scope: true,
    },
  },
} satisfies Prisma.RecurringInclude;

/**
 * Parsea el resultado de Prisma (con include de category) al shape interno.
 */
function mapToRecurringWithCategory(
  r: Prisma.RecurringGetPayload<{ include: typeof RECURRING_INCLUDE }>,
): RecurringWithCategory {
  return {
    id: r.id,
    userId: r.userId,
    categoryId: r.categoryId,
    type: r.type,
    amountCents: r.amountCents,
    description: r.description,
    startMonth: r.startMonth,
    deletedFrom: r.deletedFrom,
    frequency: r.frequency,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    category: {
      id: r.category.id,
      name: r.category.name,
      color: r.category.color,
      scope: r.category.scope,
    },
  };
}

@Injectable()
export class RecurringRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un fijo nuevo.
   */
  async create(
    data: Prisma.RecurringCreateInput,
  ): Promise<RecurringWithCategory> {
    const r = await this.prisma.recurring.create({
      data,
      include: RECURRING_INCLUDE,
    });
    return mapToRecurringWithCategory(r);
  }

  /**
   * Busca un fijo por id (sin filtrar por userId — el caller hace la validación).
   */
  async findById(id: string): Promise<RecurringWithCategory | null> {
    const r = await this.prisma.recurring.findUnique({
      where: { id },
      include: RECURRING_INCLUDE,
    });
    if (!r) return null;
    return mapToRecurringWithCategory(r);
  }

  /**
   * Actualiza un fijo por id (update in-place para el caso sin pasado — D1).
   */
  async update(
    id: string,
    data: Prisma.RecurringUpdateInput,
  ): Promise<RecurringWithCategory> {
    const r = await this.prisma.recurring.update({
      where: { id },
      data,
      include: RECURRING_INCLUDE,
    });
    return mapToRecurringWithCategory(r);
  }

  /**
   * Elimina físicamente un fijo por id (hard delete — solo cuando boundary <= startMonth).
   */
  async delete(id: string): Promise<void> {
    await this.prisma.recurring.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Skips (P1 — Fase 1.1.1)
  // ---------------------------------------------------------------------------

  /**
   * Verifica si existe un skip para (recurringId, month).
   */
  async findSkip(
    recurringId: string,
    month: string,
  ): Promise<boolean> {
    const skip = await this.prisma.recurringSkip.findUnique({
      where: { recurringId_month: { recurringId, month } },
    });
    return skip !== null;
  }

  /**
   * Crea un skip para (recurringId, month).
   */
  async createSkip(recurringId: string, month: string): Promise<void> {
    await this.prisma.recurringSkip.create({
      data: { recurringId, month },
    });
  }

  /**
   * Elimina un skip para (recurringId, month).
   */
  async deleteSkip(recurringId: string, month: string): Promise<void> {
    await this.prisma.recurringSkip.delete({
      where: { recurringId_month: { recurringId, month } },
    });
  }

  /**
   * Devuelve el set de meses salteados de un fijo dado como Set<string>.
   * Útil para las queries del mes y del año donde ya se tiene el recurringId.
   */
  async findSkipsForRecurring(recurringId: string): Promise<Set<string>> {
    const skips = await this.prisma.recurringSkip.findMany({
      where: { recurringId },
      select: { month: true },
    });
    return new Set(skips.map((s) => s.month));
  }

  /**
   * Devuelve el set de meses salteados de TODOS los fijos del usuario como Map<recurringId, Set<month>>.
   * Usada en las queries de proyección mensual/anual para aplicar skips en memoria.
   */
  async findAllSkipsForUser(
    userId: string,
  ): Promise<Map<string, Set<string>>> {
    // Traer todos los skips de fijos del usuario (join vía Recurring.userId)
    const skips = await this.prisma.recurringSkip.findMany({
      where: {
        recurring: { userId },
      },
      select: {
        recurringId: true,
        month: true,
      },
    });

    const result = new Map<string, Set<string>>();
    for (const s of skips) {
      if (!result.has(s.recurringId)) {
        result.set(s.recurringId, new Set<string>());
      }
      result.get(s.recurringId)!.add(s.month);
    }
    return result;
  }
}
