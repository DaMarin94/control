import { Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
 * Shape completo de una transacción con categoría embebida.
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
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
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
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    category: {
      id: tx.category.id,
      name: tx.category.name,
      color: tx.category.color,
      scope: tx.category.scope,
    },
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
   * Lista transacciones del usuario cuyo occurredAt UTC cae dentro del rango dado.
   * Orden: occurredAt descendente (más reciente primero, RF-VM-001).
   *
   * El criterio de bucketeo por mes es: rango UTC calculado a partir del mes YYYY-MM
   * en la timezone del usuario (pasada como parámetro).
   * Ver TransactionsService.findByMonth para los detalles.
   */
  async findByUserAndDateRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<TransactionWithCategory[]> {
    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        occurredAt: {
          gte: from,
          lt: to,
        },
      },
      orderBy: { occurredAt: 'desc' },
      include: TRANSACTION_INCLUDE,
    });
    return txs.map(mapToTransactionWithCategory);
  }

  /**
   * Busca una transacción por id (sin filtrar por userId — el caller hace la validación).
   */
  async findById(id: string): Promise<TransactionWithCategory | null> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
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
   * Elimina permanentemente una transacción por id (hard delete, RF-MU-003).
   */
  async delete(id: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id } });
  }
}
