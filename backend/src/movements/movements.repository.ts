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
 * Shape del campo installment para ítems de cuotas (D1 — Fase 7).
 * - number: número de cuota en el mes consultado (1-based)
 * - total: total de cuotas del grupo (totalInstallments)
 * - startMonth: mes de inicio del grupo (YYYY-MM)
 *
 * Para únicos y fijos: null.
 */
export interface InstallmentInfo {
  number: number;
  total: number;
  startMonth: string;
}

/**
 * MovementItem — ítem de la lista unificada del mes.
 *
 * El campo `origin` discrimina el tipo de movimiento para el front:
 * - 'unico': movimiento único (Transaction)
 * - 'fijo':  movimiento fijo activo en el mes (Recurring)
 * - 'cuota': cuota de un grupo InstallmentGroup activa en el mes
 *
 * D1/D3 — occurredAt y timezone son nullable:
 * - Únicos: ambos tienen valor (instante + zona)
 * - Fijos y cuotas: ambos son null (operan a nivel mes, sin día/hora/zona)
 *
 * D1 — campo installment:
 * - Cuotas: { number, total, startMonth }
 * - Únicos y fijos: null / ausente
 */
export interface MovementItem {
  id: string;
  origin: 'unico' | 'fijo' | 'cuota';
  type: MovementType;
  amountCents: number;
  description: string | null;
  occurredAt: Date | null;
  timezone: string | null;
  category: MovementEmbeddedCategory;
  installment: InstallmentInfo | null;
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
   * Orden: amountCents DESC (monto más alto primero); desempate por occurredAt DESC
   * para resultados estables cuando dos registros tienen el mismo monto.
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
    // monthEnd is used implicitly via the SQL comparison; suppress TS unused warning
    void monthEnd;

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
      ORDER BY t."amountCents" DESC, t."occurredAt" DESC
    `;

    return rows.map((row) => this.mapRowToMovementItem(row));
  }

  /**
   * Lista los movimientos fijos (Recurring) activos en el mes YYYY-MM.
   *
   * Condición de actividad (comparación léxica de strings YYYY-MM):
   *   startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)
   *
   * Los fijos son a nivel mes, sin día ni hora: no requieren SQL raw ni AT TIME ZONE.
   * La comparación léxica de strings YYYY-MM es correcta porque ese formato
   * ordena lexicográficamente igual que cronológicamente.
   *
   * La categoría se incluye AUNQUE esté soft-deleted (RF-CAT-004):
   * un fijo histórico sigue mostrando su categoría aunque haya sido eliminada.
   *
   * Los fijos no tienen occurredAt ni timezone (D3): ambos se mapean a null.
   * El campo installment es null para fijos.
   */
  async findFijosByMonth(
    userId: string,
    month: string,
  ): Promise<MovementItem[]> {
    const recurrings = await this.prisma.recurring.findMany({
      where: {
        userId,
        startMonth: { lte: month },
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: month } },
        ],
      },
      orderBy: [
        { amountCents: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            scope: true,
          },
        },
      },
    });

    return recurrings.map((r) => ({
      id: r.id,
      origin: 'fijo' as const,
      type: r.type,
      amountCents: r.amountCents,
      description: r.description,
      occurredAt: null,
      timezone: null,
      category: {
        id: r.category.id,
        name: r.category.name,
        color: r.category.color,
        scope: r.category.scope as CategoryScope,
      },
      installment: null,
    }));
  }

  /**
   * Lista los grupos de cuotas (InstallmentGroup) activos en el mes YYYY-MM.
   *
   * Un grupo está activo en el mes consultado si:
   *   startMonth <= month  AND  month < addMonths(startMonth, totalInstallments)
   *
   * Es decir: la cuota 1 cae en startMonth y la última (N) en
   * addMonths(startMonth, totalInstallments - 1). Si addMonths(startMonth, N) > month,
   * el mes consultado cae dentro del rango.
   *
   * Algoritmo:
   * 1. Traer todos los grupos donde startMonth <= month (incluye categoría aunque soft-deleted).
   * 2. Filtrar en JS los que todavía no terminaron.
   * 3. Calcular el número de cuota en el mes consultado.
   *
   * La categoría se incluye AUNQUE esté soft-deleted (RF-CAT-004).
   * occurredAt y timezone son null (D1): cuotas operan a nivel mes.
   *
   * Nota: usar Prisma ORM normal (no $queryRaw) — las cuotas son a nivel mes,
   * sin day/hora/zona, igual que los fijos.
   */
  async findCuotasByMonth(
    userId: string,
    month: string,
  ): Promise<MovementItem[]> {
    // Paso 1: grupos cuyo startMonth <= month
    const groups = await this.prisma.installmentGroup.findMany({
      where: {
        userId,
        startMonth: { lte: month },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            scope: true,
          },
        },
      },
    });

    const result: MovementItem[] = [];

    for (const g of groups) {
      // Paso 2: verificar si el mes consultado cae dentro del rango de cuotas
      // El grupo cubre desde startMonth hasta addMonths(startMonth, totalInstallments - 1)
      // La condición de actividad es: month < addMonths(startMonth, totalInstallments)
      const endMonth = addMonths(g.startMonth, g.totalInstallments);
      if (month >= endMonth) {
        // La última cuota ya pasó — el grupo no está activo en este mes
        continue;
      }

      // Paso 3: calcular el número de cuota (1-based)
      const number = monthDiff(g.startMonth, month) + 1;

      result.push({
        id: g.id,
        origin: 'cuota' as const,
        type: g.type,
        amountCents: g.amountCents,
        description: g.description,
        occurredAt: null,
        timezone: null,
        category: {
          id: g.category.id,
          name: g.category.name,
          color: g.category.color,
          scope: g.category.scope as CategoryScope,
        },
        installment: {
          number,
          total: g.totalInstallments,
          startMonth: g.startMonth,
        },
      });
    }

    // Ordenar por amountCents DESC; desempate por id (CUID, lexicográfico) para
    // que el resultado sea determinístico cuando dos grupos tienen el mismo monto.
    result.sort(
      (a, b) => b.amountCents - a.amountCents || a.id.localeCompare(b.id),
    );

    return result;
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

  /**
   * Calcula los totales de los movimientos fijos activos en el mes.
   *
   * Condición de actividad: misma que findFijosByMonth (comparación léxica de YYYY-MM).
   * Usa Prisma ORM normal (no SQL raw) — los fijos no necesitan AT TIME ZONE.
   */
  async getFijosTotalsByMonth(
    userId: string,
    month: string,
  ): Promise<{ expenseCents: number; incomeCents: number }> {
    const recurrings = await this.prisma.recurring.findMany({
      where: {
        userId,
        startMonth: { lte: month },
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: month } },
        ],
      },
      select: {
        type: true,
        amountCents: true,
      },
    });

    let expenseCents = 0;
    let incomeCents = 0;

    for (const r of recurrings) {
      if (r.type === MovementType.EXPENSE) {
        expenseCents += r.amountCents;
      } else {
        incomeCents += r.amountCents;
      }
    }

    return { expenseCents, incomeCents };
  }

  /**
   * Calcula los totales de los grupos de cuotas activos en el mes.
   *
   * Las cuotas son siempre EXPENSE en v1 (decisión D1).
   * La condición de actividad es la misma que findCuotasByMonth.
   */
  async getCuotasTotalsByMonth(
    userId: string,
    month: string,
  ): Promise<{ expenseCents: number; incomeCents: number }> {
    const groups = await this.prisma.installmentGroup.findMany({
      where: {
        userId,
        startMonth: { lte: month },
      },
      select: {
        type: true,
        amountCents: true,
        totalInstallments: true,
        startMonth: true,
      },
    });

    let expenseCents = 0;
    let incomeCents = 0;

    for (const g of groups) {
      const endMonth = addMonths(g.startMonth, g.totalInstallments);
      if (month >= endMonth) {
        continue; // ya terminó
      }

      if (g.type === MovementType.EXPENSE) {
        expenseCents += g.amountCents;
      } else {
        incomeCents += g.amountCents;
      }
    }

    return { expenseCents, incomeCents };
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
      installment: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers de cálculo de mes (YYYY-MM) — exportados para uso en tests
// ---------------------------------------------------------------------------

/**
 * Suma N meses a un string YYYY-MM con rollover de año correcto.
 *
 * Ejemplos:
 *   addMonths('2026-06', 3)  → '2026-09'
 *   addMonths('2026-11', 3)  → '2027-02'
 *   addMonths('2026-12', 1)  → '2027-01'
 *
 * Se usa para calcular el mes de fin (exclusivo) de un grupo de cuotas:
 *   endMonth = addMonths(startMonth, totalInstallments)
 * La cuota N (última) cae en addMonths(startMonth, N-1).
 * Si month < endMonth, el mes consultado tiene cuota activa.
 */
export function addMonths(yyyyMM: string, n: number): string {
  const [yearStr, monthStr] = yyyyMM.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-based

  month += n;

  // Normalizar: month puede ser >= 12 o incluso > 12*muchos
  year += Math.floor(month / 12);
  month = month % 12;
  // Forzar positivo (en caso de n negativo — no esperado pero por robustez)
  if (month < 0) {
    month += 12;
    year -= 1;
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Calcula la diferencia en meses entre dos strings YYYY-MM (b - a).
 *
 * monthDiff('2026-06', '2026-08') → 2
 * monthDiff('2026-06', '2026-06') → 0
 * monthDiff('2026-11', '2027-02') → 3
 *
 * Se usa para calcular el número de cuota:
 *   number = monthDiff(startMonth, month) + 1  (1-based)
 */
export function monthDiff(a: string, b: string): number {
  const [yearA, monthA] = a.split('-').map(Number);
  const [yearB, monthB] = b.split('-').map(Number);
  return (yearB - yearA) * 12 + (monthB - monthA);
}
