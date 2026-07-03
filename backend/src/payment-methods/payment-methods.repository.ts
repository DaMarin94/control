import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape de un método de pago con contadores de movimientos asociados.
 * El campo `movementCount` es la suma de transactions + recurrings + installmentGroups.
 * Espejo de CategoryWithCount (categories.repository.ts).
 */
export interface PaymentMethodWithCount {
  id: string;
  userId: string;
  name: string;
  type: string;
  closingDay: number | null;
  paymentDay: number | null;
  icon: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  movementCount: number;
}

const COUNT_SELECT = {
  transactions: true,
  recurrings: true,
  installmentGroups: true,
} satisfies Prisma.PaymentMethodCountOutputTypeSelect;

type PaymentMethodRow = Prisma.PaymentMethodGetPayload<{
  include: { _count: { select: typeof COUNT_SELECT } };
}>;

function mapToPaymentMethodWithCount(pm: PaymentMethodRow): PaymentMethodWithCount {
  return {
    id: pm.id,
    userId: pm.userId,
    name: pm.name,
    type: pm.type,
    closingDay: pm.closingDay,
    paymentDay: pm.paymentDay,
    icon: pm.icon,
    deletedAt: pm.deletedAt,
    createdAt: pm.createdAt,
    updatedAt: pm.updatedAt,
    movementCount:
      pm._count.transactions + pm._count.recurrings + pm._count.installmentGroups,
  };
}

@Injectable()
export class PaymentMethodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista métodos de pago ACTIVOS del usuario con conteo de movimientos (RF-PM-005).
   * Orden: nombre ascendente (espejo de categorías).
   */
  async findActiveByUser(userId: string): Promise<PaymentMethodWithCount[]> {
    const rows = await this.prisma.paymentMethod.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: COUNT_SELECT } },
    });
    return rows.map(mapToPaymentMethodWithCount);
  }

  /**
   * Busca métodos de pago del usuario cuyo nombre normalizado coincida con el dado.
   * Devuelve activo y eliminado por separado para el flujo crear-o-reactivar (RF-PM-001, A4).
   *
   * La normalización se aplica en memoria (mismo motivo que categorías: Postgres no
   * tiene strip_diacritics estándar sin extensión, y el volumen por usuario es chico).
   */
  async findByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<{
    active: PaymentMethodWithCount | null;
    deleted: PaymentMethodWithCount | null;
  }> {
    const all = await this.prisma.paymentMethod.findMany({
      where: { userId },
      include: { _count: { select: COUNT_SELECT } },
    });

    const withCount = all.map(mapToPaymentMethodWithCount);
    const matching = withCount.filter(
      (pm) => normalizePaymentMethodName(pm.name) === normalizedName,
    );

    const active = matching.find((pm) => pm.deletedAt === null) ?? null;
    const deleted = matching.find((pm) => pm.deletedAt !== null) ?? null;

    return { active, deleted };
  }

  /**
   * Busca métodos de pago activos del usuario para detectar colisiones al editar,
   * excluyendo el propio método (por id).
   */
  async findActiveExcluding(
    userId: string,
    excludeId: string,
  ): Promise<PaymentMethodWithCount[]> {
    const rows = await this.prisma.paymentMethod.findMany({
      where: { userId, deletedAt: null, id: { not: excludeId } },
      include: { _count: { select: COUNT_SELECT } },
    });
    return rows.map(mapToPaymentMethodWithCount);
  }

  /** Busca un método de pago por id, sin filtrar por userId (el caller valida ownership). */
  async findById(id: string): Promise<PaymentMethodWithCount | null> {
    const pm = await this.prisma.paymentMethod.findUnique({
      where: { id },
      include: { _count: { select: COUNT_SELECT } },
    });
    if (!pm) return null;
    return mapToPaymentMethodWithCount(pm);
  }

  /** Crea un método de pago nuevo. */
  async create(
    data: Prisma.PaymentMethodCreateInput,
  ): Promise<PaymentMethodWithCount> {
    const pm = await this.prisma.paymentMethod.create({
      data,
      include: { _count: { select: COUNT_SELECT } },
    });
    return mapToPaymentMethodWithCount(pm);
  }

  /** Actualiza un método de pago por id. */
  async update(
    id: string,
    data: Prisma.PaymentMethodUpdateInput,
  ): Promise<PaymentMethodWithCount> {
    const pm = await this.prisma.paymentMethod.update({
      where: { id },
      data,
      include: { _count: { select: COUNT_SELECT } },
    });
    return mapToPaymentMethodWithCount(pm);
  }
}

/**
 * Normaliza un nombre de método de pago para comparación de colisiones (RN-014,
 * espejo exacto de `normalizeName` en categories.repository.ts).
 *
 * Aplica: trim + lowercase + NFD + strip de diacríticos.
 * El nombre ORIGINAL se almacena tal como lo escribió el usuario.
 */
export function normalizePaymentMethodName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
