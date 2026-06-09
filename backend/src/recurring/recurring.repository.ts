import { Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
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
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
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
}
