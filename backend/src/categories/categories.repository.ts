import { Injectable } from '@nestjs/common';
import { CategoryScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape de una categoría con contadores de movimientos asociados.
 * El campo `movementCount` es la suma de transactions + recurrings + installmentGroups.
 */
export interface CategoryWithCount {
  id: string;
  userId: string;
  name: string;
  scope: CategoryScope;
  color: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  movementCount: number;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista categorías ACTIVAS del usuario con conteo de movimientos (RF-CAT-006).
   * Orden: nombre ascendente (estable y predecible para el usuario).
   */
  async findActiveByUser(userId: string): Promise<CategoryWithCount[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            transactions: true,
            recurrings: true,
            installmentGroups: true,
          },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      scope: cat.scope,
      color: cat.color,
      deletedAt: cat.deletedAt,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      movementCount:
        cat._count.transactions +
        cat._count.recurrings +
        cat._count.installmentGroups,
    }));
  }

  /**
   * Busca categorías del usuario cuyo nombre normalizado coincida con el dado.
   * Devuelve activas y eliminadas por separado para implementar el flujo crear-o-reactivar.
   *
   * La normalización (trim + lowercase + sin diacríticos) se aplica en memoria
   * porque Postgres no tiene una función de strip_diacritics estándar sin extensión.
   * El volumen de categorías por usuario es pequeño (< 100), por lo que cargar
   * todas y filtrar en memoria es aceptable.
   */
  async findByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<{
    active: CategoryWithCount | null;
    deleted: CategoryWithCount | null;
  }> {
    const all = await this.prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            transactions: true,
            recurrings: true,
            installmentGroups: true,
          },
        },
      },
    });

    const withCount = all.map((cat) => ({
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      scope: cat.scope,
      color: cat.color,
      deletedAt: cat.deletedAt,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      movementCount:
        cat._count.transactions +
        cat._count.recurrings +
        cat._count.installmentGroups,
    }));

    const matching = withCount.filter(
      (cat) => normalizeName(cat.name) === normalizedName,
    );

    const active = matching.find((c) => c.deletedAt === null) ?? null;
    const deleted = matching.find((c) => c.deletedAt !== null) ?? null;

    return { active, deleted };
  }

  /**
   * Busca categorías activas del usuario para detectar colisiones al editar,
   * excluyendo la propia categoría (por id).
   */
  async findActiveExcluding(
    userId: string,
    excludeId: string,
  ): Promise<CategoryWithCount[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId, deletedAt: null, id: { not: excludeId } },
      include: {
        _count: {
          select: {
            transactions: true,
            recurrings: true,
            installmentGroups: true,
          },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      scope: cat.scope,
      color: cat.color,
      deletedAt: cat.deletedAt,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      movementCount:
        cat._count.transactions +
        cat._count.recurrings +
        cat._count.installmentGroups,
    }));
  }

  /** Busca una categoría por id, sin filtrar por userId (la validación de ownership la hace el caller). */
  async findById(id: string): Promise<CategoryWithCount | null> {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            recurrings: true,
            installmentGroups: true,
          },
        },
      },
    });

    if (!cat) return null;

    return {
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      scope: cat.scope,
      color: cat.color,
      deletedAt: cat.deletedAt,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      movementCount:
        cat._count.transactions +
        cat._count.recurrings +
        cat._count.installmentGroups,
    };
  }

  /** Crea una categoría nueva. */
  async create(
    data: Prisma.CategoryCreateInput,
  ): Promise<CategoryWithCount> {
    const cat = await this.prisma.category.create({
      data,
      include: {
        _count: {
          select: {
            transactions: true,
            recurrings: true,
            installmentGroups: true,
          },
        },
      },
    });

    return {
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      scope: cat.scope,
      color: cat.color,
      deletedAt: cat.deletedAt,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      movementCount:
        cat._count.transactions +
        cat._count.recurrings +
        cat._count.installmentGroups,
    };
  }

  /** Actualiza una categoría por id. */
  async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
  ): Promise<CategoryWithCount> {
    const cat = await this.prisma.category.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            transactions: true,
            recurrings: true,
            installmentGroups: true,
          },
        },
      },
    });

    return {
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      scope: cat.scope,
      color: cat.color,
      deletedAt: cat.deletedAt,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      movementCount:
        cat._count.transactions +
        cat._count.recurrings +
        cat._count.installmentGroups,
    };
  }

  /**
   * Cuenta cuántas categorías activas del usuario tienen cada color del pool.
   * Usado para la asignación automática de color (RF-CAT-005).
   */
  async countActiveByColor(userId: string): Promise<Map<string, number>> {
    const categories = await this.prisma.category.findMany({
      where: { userId, deletedAt: null },
      select: { color: true },
    });

    const colorCount = new Map<string, number>();
    for (const cat of categories) {
      colorCount.set(cat.color, (colorCount.get(cat.color) ?? 0) + 1);
    }

    return colorCount;
  }
}

/**
 * Normaliza un nombre de categoría para comparación de colisiones (RN-014).
 *
 * Aplica:
 * 1. trim() — elimina espacios al inicio y fin
 * 2. toLowerCase() — insensible a mayúsculas
 * 3. normalize('NFD') + regex diacríticos — insensible a acentos
 *    (ej: "Café" == "cafe", "Héroe" == "heroe")
 *
 * El nombre ORIGINAL (con capitalización y acentos) se almacena tal como lo
 * escribió el usuario. La normalización es SOLO para comparar colisiones.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
