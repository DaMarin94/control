import { Injectable } from '@nestjs/common';
import { CategoryScope, MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape de categoría embebida en un MovementItem.
 * Se incluye AUNQUE la categoría esté soft-deleted (RF-CAT-004):
 * un movimiento histórico sigue mostrando el nombre de su categoría.
 */
export interface MovementEmbeddedCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * MovementItem — ítem de la lista unificada del mes.
 *
 * El campo `origin` discrimina el tipo de movimiento para el front.
 * Hoy solo existe "unico"; se preparó el shape para "fijo" y "cuota".
 */
export interface MovementItem {
  id: string;
  origin: 'unico';
  type: MovementType;
  amountCents: number;
  description: string | null;
  occurredAt: Date;
  timezone: string;
  category: MovementEmbeddedCategory;
}

/**
 * Shape interno de una fila devuelta por el SQL raw de movimientos únicos.
 * Los nombres de columnas en $queryRaw de Prisma 7 vienen en camelCase
 * si el SQL usa alias explícitos; de lo contrario, en snake_case.
 * Usamos alias explícitos para claridad.
 */
interface RawTransactionRow {
  id: string;
  userId: string;
  type: string;
  amountCents: number;
  description: string | null;
  occurredAt: Date;
  timezone: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
}

/**
 * Shape interno de una fila de totales devuelta por el SQL raw.
 */
interface RawTotalsRow {
  expenseCents: bigint;
  incomeCents: bigint;
}

@Injectable()
export class MovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los movimientos únicos (Transaction) que pertenecen al mes YYYY-MM,
   * bucketando por la timezone propia de CADA registro (AT TIME ZONE t.timezone).
   *
   * SQL parametrizado — SEGURO contra inyección:
   * - $1 = userId (string)
   * - $2 = mes en formato 'YYYY-MM-01' (fecha de inicio del mes)
   * - $3 = mes siguiente en formato 'YYYY-MM-01' (fecha de fin exclusiva)
   *
   * La expresión:
   *   date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
   * devuelve el inicio del mes LOCAL de cada registro.
   * Comparamos contra el inicio del mes pedido (también expresado como
   * un timestamp literal sin zona) para que la comparación sea en "tiempo local"
   * del registro.
   *
   * Nota: el cast ::timestamptz interpreta el literal como UTC y luego AT TIME ZONE
   * lo convierte a local. El date_trunc sobre el resultado local nos da el inicio
   * del mes local. Comparar ese resultado contra '2026-06-01'::timestamp (sin zona)
   * es la forma correcta: ambos son "naive datetime" en la misma zona local del registro.
   *
   * La categoría se incluye AUNQUE esté soft-deleted (deletedAt != null):
   * RF-CAT-004 especifica que movimientos históricos siguen mostrando su categoría.
   *
   * Orden: occurredAt DESC (más reciente primero, RF-VM-001).
   *
   * Seguridad: $1, $2, $3 son parámetros posicionales de pg — nunca interpolados.
   */
  async findUnicosByMonth(
    userId: string,
    month: string,
  ): Promise<MovementItem[]> {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    // Mes pedido como "YYYY-MM-01" (primer día del mes)
    const monthStart = `${yearStr}-${monthStr}-01`;

    // Mes siguiente como "YYYY-MM-01"
    let nextYear = year;
    let nextMonth = monthNum + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // SQL raw con parámetros posicionales (protección anti-inyección de Prisma 7)
    // Prisma 7 con adapter pg expone $queryRaw con template literals usando Prisma.sql
    // pero también soporta $queryRawUnsafe con parámetros posicionales.
    // Usamos $queryRaw con Prisma.sql para máxima seguridad.
    const rows = await this.prisma.$queryRaw<RawTransactionRow[]>`
      SELECT
        t.id             AS "id",
        t."userId"       AS "userId",
        t.type::text     AS "type",
        t."amountCents"  AS "amountCents",
        t.description    AS "description",
        t."occurredAt"   AS "occurredAt",
        t.timezone       AS "timezone",
        t."categoryId"   AS "categoryId",
        c.name           AS "categoryName",
        c.color          AS "categoryColor",
        c.scope::text    AS "categoryScope"
      FROM "Transaction" t
      JOIN "Category" c ON c.id = t."categoryId"
      WHERE
        t."userId" = ${userId}
        AND date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
            = date_trunc('month', ${monthStart}::timestamp)
      ORDER BY t."occurredAt" DESC
    `;

    return rows.map((row) => this.mapRowToMovementItem(row));
  }

  /**
   * Calcula los totales de movimientos únicos del mes.
   *
   * Mismo criterio de bucketeo que findUnicosByMonth: AT TIME ZONE del registro.
   * El cálculo se hace en la misma query para eficiencia.
   *
   * Seguridad: parámetros posicionales, nunca interpolados.
   */
  async getTotalsByMonth(
    userId: string,
    month: string,
  ): Promise<{ expenseCents: number; incomeCents: number }> {
    const [yearStr, monthStr] = month.split('-');

    const monthStart = `${yearStr}-${monthStr}-01`;

    const rows = await this.prisma.$queryRaw<RawTotalsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t."amountCents" ELSE 0 END), 0) AS "expenseCents",
        COALESCE(SUM(CASE WHEN t.type = 'INCOME'  THEN t."amountCents" ELSE 0 END), 0) AS "incomeCents"
      FROM "Transaction" t
      WHERE
        t."userId" = ${userId}
        AND date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
            = date_trunc('month', ${monthStart}::timestamp)
    `;

    // $queryRaw de pg devuelve BIGINT de Postgres como BigInt de JS
    const row = rows[0];
    return {
      expenseCents: Number(row.expenseCents),
      incomeCents: Number(row.incomeCents),
    };
  }

  // ---------------------------------------------------------------------------
  // Mappers privados
  // ---------------------------------------------------------------------------

  private mapRowToMovementItem(row: RawTransactionRow): MovementItem {
    return {
      id: row.id,
      origin: 'unico',
      type: row.type as MovementType,
      amountCents: Number(row.amountCents),
      description: row.description,
      occurredAt: row.occurredAt,
      timezone: row.timezone,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        color: row.categoryColor,
        scope: row.categoryScope as CategoryScope,
      },
    };
  }
}
