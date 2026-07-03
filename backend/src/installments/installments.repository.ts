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
 * Shape de método de pago embebido (RF-PM-006). `null` si el grupo no tiene método.
 */
export interface EmbeddedPaymentMethod {
  id: string;
  name: string;
  icon: string;
  type: string;
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
  /** Cotización anchorCurrency/1 currency del grupo (Fase 1.2.3/1.2.4). */
  exchangeRate: number;
  /** Moneda default del usuario al momento de guardar el grupo (Fase 1.2.4). */
  anchorCurrency: Currency;
  /** Método de pago asociado; null = sin método (RF-PM-006) */
  paymentMethodId: string | null;
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del MOVIMIENTO.
   * Único para todo el grupo. Solo puede ser true/false si paymentMethod es de
   * tipo DEBIT; en cualquier otro caso queda null.
   */
  autoDebit: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
  paymentMethod: EmbeddedPaymentMethod | null;
}

/**
 * Resultado del toggle de skip (P3 — Fase 1.1.1.ext). Espejo de SkipToggleResult (recurring).
 * - skipped: true si el mes quedó anulado (se creó el skip); false si fue des-anulado (se borró).
 * - month: mes que fue toggleado.
 */
export interface SkipToggleResult {
  skipped: boolean;
  month: string;
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
  paymentMethod: {
    select: {
      id: true,
      name: true,
      icon: true,
      type: true,
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
    anchorCurrency: g.anchorCurrency,
    paymentMethodId: g.paymentMethodId,
    autoDebit: g.autoDebit,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    category: {
      id: g.category.id,
      name: g.category.name,
      color: g.category.color,
      scope: g.category.scope,
    },
    paymentMethod: g.paymentMethod
      ? {
          id: g.paymentMethod.id,
          name: g.paymentMethod.name,
          icon: g.paymentMethod.icon,
          type: g.paymentMethod.type,
        }
      : null,
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

  // ---------------------------------------------------------------------------
  // Skips (P3 — Fase 1.1.1.ext). Espejo exacto de RecurringRepository — skips.
  // ---------------------------------------------------------------------------

  /**
   * Verifica si existe un skip para (installmentGroupId, month).
   */
  async findSkip(installmentGroupId: string, month: string): Promise<boolean> {
    const skip = await this.prisma.installmentSkip.findUnique({
      where: { installmentGroupId_month: { installmentGroupId, month } },
    });
    return skip !== null;
  }

  /**
   * Crea un skip para (installmentGroupId, month).
   */
  async createSkip(installmentGroupId: string, month: string): Promise<void> {
    await this.prisma.installmentSkip.create({
      data: { installmentGroupId, month },
    });
  }

  /**
   * Elimina un skip para (installmentGroupId, month).
   */
  async deleteSkip(installmentGroupId: string, month: string): Promise<void> {
    await this.prisma.installmentSkip.delete({
      where: { installmentGroupId_month: { installmentGroupId, month } },
    });
  }
}
