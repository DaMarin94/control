import { Injectable } from '@nestjs/common';
import { Currency, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOT_DELETED } from '../common/soft-delete.helper';

/**
 * Shape de categoría embebida en una transacción.
 * Se incluye siempre para que el frontend pueda mostrarla sin request adicional.
 */
export interface EmbeddedCategory {
  id: string;
  name: string;
  color: string;
  scope: string;
}

/**
 * Shape de método de pago embebido (RF-PM-006). `null` si el movimiento no tiene método.
 */
export interface EmbeddedPaymentMethod {
  id: string;
  name: string;
  icon: string;
  type: string;
}

/**
 * Shape completo de una transacción con categoría (y método de pago) embebidos.
 */
export interface TransactionWithCategory {
  id: string;
  userId: string;
  categoryId: string;
  type: MovementType;
  amountCents: number;
  description: string | null;
  occurredAt: Date;
  timezone: string;
  /** Moneda original del movimiento (Fase 1.2.3) */
  currency: Currency;
  /** Cotización anchorCurrency/1 currency al momento del movimiento (Fase 1.2.3/1.2.4) */
  exchangeRate: number;
  /** Moneda default del usuario al momento de guardar el movimiento (Fase 1.2.4) */
  anchorCurrency: Currency;
  /** true si el único está anulado (P3 — Fase 1.1.1.ext). No suma a totales ni reportes. */
  skipped: boolean;
  /** Método de pago asociado; null = sin método (RF-PM-006) */
  paymentMethodId: string | null;
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del MOVIMIENTO.
   * Solo puede ser true/false si paymentMethod es de tipo DEBIT; en cualquier
   * otro caso queda null (coherencia impuesta por PaymentMethodValidatorService).
   */
  autoDebit: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
  paymentMethod: EmbeddedPaymentMethod | null;
}

// Include para todas las queries de Transaction
const TRANSACTION_INCLUDE = {
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
} satisfies Prisma.TransactionInclude;

/**
 * Parsea el resultado de Prisma (con include de category) al shape interno.
 */
function mapToTransactionWithCategory(
  tx: Prisma.TransactionGetPayload<{ include: typeof TRANSACTION_INCLUDE }>,
): TransactionWithCategory {
  return {
    id: tx.id,
    userId: tx.userId,
    categoryId: tx.categoryId,
    type: tx.type,
    amountCents: tx.amountCents,
    description: tx.description,
    occurredAt: tx.occurredAt,
    timezone: tx.timezone,
    currency: tx.currency,
    // Prisma 7 devuelve Decimal para campos @db.Decimal; convertir a number para serializar
    exchangeRate: Number(tx.exchangeRate),
    anchorCurrency: tx.anchorCurrency,
    skipped: tx.skipped,
    paymentMethodId: tx.paymentMethodId,
    autoDebit: tx.autoDebit,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    category: {
      id: tx.category.id,
      name: tx.category.name,
      color: tx.category.color,
      scope: tx.category.scope,
    },
    paymentMethod: tx.paymentMethod
      ? {
          id: tx.paymentMethod.id,
          name: tx.paymentMethod.name,
          icon: tx.paymentMethod.icon,
          type: tx.paymentMethod.type,
        }
      : null,
  };
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una transacción nueva.
   */
  async create(
    data: Prisma.TransactionCreateInput,
  ): Promise<TransactionWithCategory> {
    const tx = await this.prisma.transaction.create({
      data,
      include: TRANSACTION_INCLUDE,
    });
    return mapToTransactionWithCategory(tx);
  }

  /**
   * Busca una transacción por id (sin filtrar por userId — el caller hace la validación).
   *
   * Excluye borrados lógicos (RF-HIST-006): un único eliminado no existe para el
   * resto de la app (no se puede editar, anular, duplicar ni tomar como origen).
   */
  async findById(id: string): Promise<TransactionWithCategory | null> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id, ...NOT_DELETED },
      include: TRANSACTION_INCLUDE,
    });
    if (!tx) return null;
    return mapToTransactionWithCategory(tx);
  }

  /**
   * Actualiza una transacción por id.
   */
  async update(
    id: string,
    data: Prisma.TransactionUpdateInput,
  ): Promise<TransactionWithCategory> {
    const tx = await this.prisma.transaction.update({
      where: { id },
      data,
      include: TRANSACTION_INCLUDE,
    });
    return mapToTransactionWithCategory(tx);
  }

  /**
   * Borrado lógico (RF-HIST-006): marca deletedAt = now(). El único deja de
   * aparecer en toda la app; sigue existiendo para poder restaurarlo desde el
   * historial (RF-HIST-003) hasta que se purgue (RF-HIST-005).
   */
  async softDelete(id: string): Promise<void> {
    await this.prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
