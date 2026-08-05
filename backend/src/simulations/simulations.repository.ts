import { Injectable } from '@nestjs/common';
import { CategoryScope, Simulation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOT_DELETED_TRANSACTION_SQL } from '../common/soft-delete.helper';

/**
 * Fila cruda de la agregación mensual de únicos por categoría (RN-028 — serie
 * de ajuste de la simulación). Una fila por (categoría, mes, tipo, moneda,
 * cotización, anchor) — el service la reduce a un total con signo por
 * (categoría, mes) en la moneda default vigente del usuario.
 */
export interface RawSimulationUnicoRow {
  categoryId: string;
  /** "YYYY-MM" */
  monthKey: string;
  type: string;
  currency: string;
  /** Decimal de Postgres serializado como string */
  exchangeRate: string;
  anchorCurrency: string;
  /** BigInt de Postgres (SUM) */
  totalCents: bigint;
}

/** Categoría embebida mínima (mismo shape que el resto de los módulos de movimiento). */
export interface SimulationCategoryEmbed {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

@Injectable()
export class SimulationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, categoryId: string): Promise<Simulation> {
    return this.prisma.simulation.create({ data: { userId, categoryId } });
  }

  /** Busca una simulación por id, sin filtrar por userId (ownership la valida el caller). */
  async findById(id: string): Promise<Simulation | null> {
    return this.prisma.simulation.findUnique({ where: { id } });
  }

  /** Simulación existente de una categoría puntual — para RF-SIM-001 (a lo sumo una por categoría). */
  async findByCategory(userId: string, categoryId: string): Promise<Simulation | null> {
    return this.prisma.simulation.findFirst({
      where: { userId, categoryId },
    });
  }

  /** Todas las simulaciones del usuario, orden estable por fecha de creación. */
  async findAllForUser(userId: string): Promise<Simulation[]> {
    return this.prisma.simulation.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Borrado FÍSICO (RF-SIM-004): esta especie no participa del historial de cambios. */
  async delete(id: string): Promise<void> {
    await this.prisma.simulation.delete({ where: { id } });
  }

  /**
   * Categorías por id, SIN filtrar por deletedAt (RF-CAT-004 — mismo criterio
   * que el resto del sistema: una categoría eliminada sigue embebiéndose donde
   * ya la referencian). Usado para el embed de `category` en las simulaciones
   * (a diferencia del universo de RF-SIM-001, que sí exige categorías activas —
   * ver CategoriesService.findAll en el service).
   */
  async findCategoriesByIds(ids: string[]): Promise<SimulationCategoryEmbed[]> {
    if (ids.length === 0) return [];
    return this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, color: true, scope: true },
    });
  }

  /**
   * Totales mensuales (agregados por tipo/moneda/cotización/anchor) de los
   * únicos del usuario dentro de [firstMonth..lastMonth] (RN-028 — ventana
   * histórica de 12 meses `[A-12..A-1]`), para TODAS las categorías a la vez
   * (el caller reduce por categoryId). Excluye anulados (RN-020, `NOT t.skipped`)
   * y eliminados (RN-026, `NOT_DELETED_TRANSACTION_SQL`). Bucketeo por la
   * timezone propia de cada registro (RN-011/015), igual que el resto del backend.
   */
  async getUnicosMonthlyTotalsByCategory(
    userId: string,
    firstMonth: string,
    lastMonth: string,
  ): Promise<RawSimulationUnicoRow[]> {
    return this.prisma.$queryRaw<RawSimulationUnicoRow[]>`
      SELECT
        t."categoryId"                  AS "categoryId",
        to_char(
          date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
          'YYYY-MM'
        )                                AS "monthKey",
        t.type::text                     AS "type",
        t.currency::text                 AS "currency",
        t."exchangeRate"::text           AS "exchangeRate",
        t."anchorCurrency"::text         AS "anchorCurrency",
        SUM(t."amountCents")             AS "totalCents"
      FROM "Transaction" t
      WHERE
        t."userId" = ${userId}
        AND ${NOT_DELETED_TRANSACTION_SQL}
        AND NOT t.skipped
        AND to_char(date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone), 'YYYY-MM') >= ${firstMonth}
        AND to_char(date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone), 'YYYY-MM') <= ${lastMonth}
      GROUP BY
        t."categoryId",
        date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
        t.type,
        t.currency,
        t."exchangeRate",
        t."anchorCurrency"
    `;
  }
}
