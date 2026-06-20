import { Injectable } from '@nestjs/common';
import { Currency, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape de categoría embebida en un InstallmentGroup.
 * Se incluye siempre para que el frontend pueda mostrarla sin request adicional.
 */
export interface EmbeddedCategory {
  id: string;
  name: string;
  color: string;
  scope: string;
}

/**
 * Shape completo de un grupo de cuotas con categoría embebida.
 */
export interface InstallmentGroupWithCategory {
  id: string;
  userId: string;
  categoryId: string;
  type: MovementType;
  /** Monto POR CUOTA (no el total de la compra) */
  amountCents: number;
  totalInstallments: number;
  description: string | null;
  startMonth: string;
  /** Moneda del grupo (Fase 1.2.3). Única para todas las cuotas. */
  currency: Currency;
  /** Cotización ARS/1 USD del grupo (Fase 1.2.3). */
  exchangeRate: number;
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
}

// Include para todas las queries de InstallmentGroup
const INSTALLMENT_INCLUDE = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      scope: true,
    },
  },
} satisfies Prisma.InstallmentGroupInclude;

/**
 * Parsea el resultado de Prisma (con include de category) al shape interno.
 */
function mapToInstallmentGroupWithCategory(
  g: Prisma.InstallmentGroupGetPayload<{ include: typeof INSTALLMENT_INCLUDE }>,
): InstallmentGroupWithCategory {
  return {
    id: g.id,
    userId: g.userId,
    categoryId: g.categoryId,
    type: g.type,
    amountCents: g.amountCents,
    totalInstallments: g.totalInstallments,
    description: g.description,
    startMonth: g.startMonth,
    currency: g.currency,
    exchangeRate: Number(g.exchangeRate),
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    category: {
      id: g.category.id,
      name: g.category.name,
      color: g.category.color,
      scope: g.category.scope,
    },
  };
}

@Injectable()
export class InstallmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un grupo de cuotas nuevo.
   */
  async create(
    data: Prisma.InstallmentGroupCreateInput,
  ): Promise<InstallmentGroupWithCategory> {
    const g = await this.prisma.installmentGroup.create({
      data,
      include: INSTALLMENT_INCLUDE,
    });
    return mapToInstallmentGroupWithCategory(g);
  }

  /**
   * Busca un grupo de cuotas por id (sin filtrar por userId — el caller hace la validación).
   */
  async findById(id: string): Promise<InstallmentGroupWithCategory | null> {
    const g = await this.prisma.installmentGroup.findUnique({
      where: { id },
      include: INSTALLMENT_INCLUDE,
    });
    if (!g) return null;
    return mapToInstallmentGroupWithCategory(g);
  }

  /**
   * Actualiza un grupo de cuotas por id (siempre in-place: cuotas no tienen split).
   */
  async update(
    id: string,
    data: Prisma.InstallmentGroupUpdateInput,
  ): Promise<InstallmentGroupWithCategory> {
    const g = await this.prisma.installmentGroup.update({
      where: { id },
      data,
      include: INSTALLMENT_INCLUDE,
    });
    return mapToInstallmentGroupWithCategory(g);
  }

  /**
   * Hard delete físico de un grupo de cuotas (RF-MC-002).
   * Elimina el grupo completo permanentemente.
   */
  async delete(id: string): Promise<void> {
    await this.prisma.installmentGroup.delete({ where: { id } });
  }
}
