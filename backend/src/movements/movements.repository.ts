import { Injectable } from '@nestjs/common';
import { CategoryScope, MovementType, RecurringFrequency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Interfaces para la agregación anual
// ---------------------------------------------------------------------------

/**
 * Fila devuelta por el SQL raw de agregación anual de únicos.
 * Una fila por (mes local, categoryId, type).
 */
interface RawAnnualUnicoRow {
  /** Mes en formato YYYY-MM (calculado con AT TIME ZONE del registro) */
  monthKey: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
  type: string;
  /** BigInt de JS — resultado de SUM de Postgres */
  totalCents: bigint;
}

/**
 * Shape de una fila de Recurring para la proyección anual.
 * Incluye frequency (P2) y skippedMonths (P1) — Fase 1.1.1.
 */
export interface RecurringForAnnual {
  id: string;
  type: MovementType;
  amountCents: number;
  startMonth: string;
  deletedFrom: string | null;
  frequency: RecurringFrequency;
  /** Set de meses salteados (YYYY-MM) — vacío si no tiene skips */
  skippedMonths: Set<string>;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
}

/**
 * Shape de una fila de InstallmentGroup para la proyección anual.
 */
export interface InstallmentGroupForAnnual {
  id: string;
  type: MovementType;
  amountCents: number;
  totalInstallments: number;
  startMonth: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
}

/**
 * Agregado intermedio de un mes para el cálculo anual.
 * Clave: "YYYY-MM".
 */
export interface MonthAggregate {
  incomeCents: number;
  expenseCents: number;
  /** Gasto por categoría en este mes: clave = categoryId */
  categoryExpense: Map<string, number>;
}

/**
 * Metadato de categoría para el resultado anual.
 */
export interface AnnualCategoryMeta {
  categoryId: string;
  name: string;
  color: string;
}

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
 *
 * P2 (Fase 1.1.1) — campo frequency:
 * - Fijos: la frecuencia del fijo (RecurringFrequency)
 * - Únicos y cuotas: null (no aplica)
 *
 * P1 (Fase 1.1.1) — campo skipped:
 * - Fijos: true si el fijo está anulado para este mes puntual (no suma a totales)
 * - Únicos y cuotas: false siempre (no tienen skip)
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
  /** Frecuencia del fijo. null para únicos y cuotas. */
  frequency: RecurringFrequency | null;
  /** true si el fijo está anulado para este mes. Siempre false para únicos y cuotas. */
  skipped: boolean;
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
   * Lista los movimientos fijos (Recurring) que aparecen en el mes YYYY-MM.
   *
   * Condición de actividad (comparación léxica de strings YYYY-MM):
   *   startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)
   *   AND monthDiff(startMonth, month) % frequencyStep(frequency) === 0
   *
   * Los fijos son a nivel mes, sin día ni hora: no requieren SQL raw ni AT TIME ZONE.
   *
   * Skips (P1 — Fase 1.1.1):
   * - Los fijos skippeados SE INCLUYEN en la lista pero con skipped=true.
   * - El caller (service) es responsable de excluirlos de los totales.
   * - Primero se filtra por rango/frecuencia en DB; luego se aplica frecuencia en JS.
   *
   * La categoría se incluye AUNQUE esté soft-deleted (RF-CAT-004).
   * occurredAt y timezone son null (D3). installment es null para fijos.
   * frequency y skipped se exponen como campos del MovementItem (P1/P2 — 1.1.1).
   */
  async findFijosByMonth(
    userId: string,
    month: string,
  ): Promise<MovementItem[]> {
    // Traer candidatos activos en el rango (la frecuencia se aplica en JS)
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
        skips: {
          where: { month },
          select: { month: true },
        },
      },
    });

    const result: MovementItem[] = [];

    for (const r of recurrings) {
      // Aplicar condición de frecuencia (P2)
      if (!isOnFrequency(r.startMonth, r.frequency, month)) {
        continue;
      }

      // El fijo aparece en este mes (puede estar skippeado)
      const skipped = r.skips.length > 0;

      result.push({
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
        frequency: r.frequency,
        skipped,
      });
    }

    return result;
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
        frequency: null,
        skipped: false,
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
   * Aplica la condición de frecuencia (P2 — Fase 1.1.1) en JS.
   * Excluye los fijos skippeados (P1 — Fase 1.1.1): si (fijo, month) está en RecurringSkip,
   * no suma a los totales.
   *
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
        startMonth: true,
        frequency: true,
        skips: {
          where: { month },
          select: { month: true },
        },
      },
    });

    let expenseCents = 0;
    let incomeCents = 0;

    for (const r of recurrings) {
      // Aplicar condición de frecuencia (P2)
      if (!isOnFrequency(r.startMonth, r.frequency, month)) {
        continue;
      }

      // Excluir fijos skippeados (P1): no suman a los totales
      if (r.skips.length > 0) {
        continue;
      }

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
  // Métodos de agregación anual (RF-GRA-001, RN-015)
  // ---------------------------------------------------------------------------

  /**
   * Devuelve la agregación de movimientos únicos del año, agrupada por
   * mes local y por (categoryId, type).
   *
   * Para cada combinación (mes local, categoría, tipo) se suma el monto.
   * El "mes local" se calcula con AT TIME ZONE propia de cada registro,
   * igual que el criterio definitivo del endpoint mensual (RN-015).
   *
   * Se filtran solo registros cuyo mes local pertenezca al año pedido:
   *   EXTRACT(year FROM date_trunc('month', "occurredAt" AT TIME ZONE timezone)) = $year
   *
   * La categoría se incluye AUNQUE esté soft-deleted (RF-CAT-004).
   *
   * $1 = userId, $2 = año (int)
   */
  async getAnnualUnicosAggregated(
    userId: string,
    year: number,
  ): Promise<RawAnnualUnicoRow[]> {
    const rows = await this.prisma.$queryRaw<RawAnnualUnicoRow[]>`
      SELECT
        to_char(
          date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
          'YYYY-MM'
        )                    AS "monthKey",
        t."categoryId"       AS "categoryId",
        c.name               AS "categoryName",
        c.color              AS "categoryColor",
        c.scope::text        AS "categoryScope",
        t.type::text         AS "type",
        SUM(t."amountCents") AS "totalCents"
      FROM "Transaction" t
      JOIN "Category" c ON c.id = t."categoryId"
      WHERE
        t."userId" = ${userId}
        AND EXTRACT(year FROM
              date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
            ) = ${year}
      GROUP BY
        date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
        t."categoryId",
        c.name,
        c.color,
        c.scope,
        t.type
      ORDER BY
        date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
        t."categoryId"
    `;
    return rows;
  }

  /**
   * Devuelve todos los movimientos fijos del usuario para la proyección anual.
   * Incluye frequency (P2) y skippedMonths (P1) — Fase 1.1.1.
   * Incluye categoría aunque esté soft-deleted (RF-CAT-004).
   * La proyección sobre los 12 meses se hace en JS en el service.
   *
   * Los skips se cargan en una query separada y se agrupan por recurringId
   * para evitar un N+1 con el include anidado de skips (que traería todas las filas
   * de RecurringSkip de todos los fijos del año en un solo JOIN).
   */
  async getAllFijosForAnnual(userId: string): Promise<RecurringForAnnual[]> {
    // Cargar fijos y skips en paralelo
    const [rows, allSkips] = await Promise.all([
      this.prisma.recurring.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          amountCents: true,
          startMonth: true,
          deletedFrom: true,
          frequency: true,
          categoryId: true,
          category: {
            select: {
              name: true,
              color: true,
              scope: true,
            },
          },
        },
      }),
      // Todos los skips del usuario (join por recurring.userId)
      this.prisma.recurringSkip.findMany({
        where: { recurring: { userId } },
        select: { recurringId: true, month: true },
      }),
    ]);

    // Construir mapa recurringId → Set<month>
    const skipMap = new Map<string, Set<string>>();
    for (const s of allSkips) {
      if (!skipMap.has(s.recurringId)) {
        skipMap.set(s.recurringId, new Set<string>());
      }
      skipMap.get(s.recurringId)!.add(s.month);
    }

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountCents: r.amountCents,
      startMonth: r.startMonth,
      deletedFrom: r.deletedFrom,
      frequency: r.frequency,
      skippedMonths: skipMap.get(r.id) ?? new Set<string>(),
      categoryId: r.categoryId,
      categoryName: r.category.name,
      categoryColor: r.category.color,
      categoryScope: r.category.scope as string,
    }));
  }

  /**
   * Devuelve todos los grupos de cuotas del usuario para la proyección anual.
   * Incluye categoría aunque esté soft-deleted (RF-CAT-004).
   * La proyección sobre los 12 meses se hace en JS en el service.
   */
  async getAllCuotasForAnnual(
    userId: string,
  ): Promise<InstallmentGroupForAnnual[]> {
    const rows = await this.prisma.installmentGroup.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        amountCents: true,
        totalInstallments: true,
        startMonth: true,
        categoryId: true,
        category: {
          select: {
            name: true,
            color: true,
            scope: true,
          },
        },
      },
    });

    return rows.map((g) => ({
      id: g.id,
      type: g.type,
      amountCents: g.amountCents,
      totalInstallments: g.totalInstallments,
      startMonth: g.startMonth,
      categoryId: g.categoryId,
      categoryName: g.category.name,
      categoryColor: g.category.color,
      categoryScope: g.category.scope as string,
    }));
  }

  /**
   * Devuelve el año más antiguo con movimientos del usuario,
   * considerando los tres tipos (RN-015):
   * - Únicos: año de su mes local (AT TIME ZONE)
   * - Fijos: año del startMonth
   * - Cuotas: año del startMonth
   *
   * Devuelve null si el usuario no tiene ningún movimiento.
   *
   * Se usan tres sub-queries (una por tipo) y se toma el MIN global.
   */
  async getEarliestYear(userId: string): Promise<number | null> {
    // Para únicos: extraemos el año del mes local (AT TIME ZONE)
    // Para fijos y cuotas: tomamos los 4 primeros chars del startMonth (YYYY)
    const rows = await this.prisma.$queryRaw<{ earliestYear: bigint | null }[]>`
      SELECT MIN(y) AS "earliestYear"
      FROM (
        -- Únicos: año del mes local del registro
        SELECT EXTRACT(year FROM
          date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
        )::int AS y
        FROM "Transaction" t
        WHERE t."userId" = ${userId}

        UNION ALL

        -- Fijos: año del startMonth (primeros 4 caracteres de YYYY-MM)
        SELECT SUBSTRING(r."startMonth" FROM 1 FOR 4)::int AS y
        FROM "Recurring" r
        WHERE r."userId" = ${userId}

        UNION ALL

        -- Cuotas: año del startMonth
        SELECT SUBSTRING(ig."startMonth" FROM 1 FOR 4)::int AS y
        FROM "InstallmentGroup" ig
        WHERE ig."userId" = ${userId}
      ) sub
    `;

    const raw = rows[0]?.earliestYear;
    if (raw === null || raw === undefined) return null;
    return Number(raw);
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
      frequency: null,
      skipped: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers de cálculo de mes (YYYY-MM) — exportados para uso en tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper de frecuencia (P2 — Fase 1.1.1)
// ---------------------------------------------------------------------------

/**
 * Devuelve el step (en meses) correspondiente a cada RecurringFrequency.
 *
 * MONTHLY=1, BIMONTHLY=2, QUARTERLY=3, BIANNUAL=6, ANNUAL=12.
 *
 * Un fijo con frecuencia F aparece en el mes M si:
 *   startMonth <= M AND (deletedFrom IS NULL OR deletedFrom > M)
 *   AND monthDiff(startMonth, M) % frequencyStep(F) === 0
 */
export function frequencyStep(frequency: RecurringFrequency): number {
  switch (frequency) {
    case RecurringFrequency.MONTHLY:    return 1;
    case RecurringFrequency.BIMONTHLY:  return 2;
    case RecurringFrequency.QUARTERLY:  return 3;
    case RecurringFrequency.BIANNUAL:   return 6;
    case RecurringFrequency.ANNUAL:     return 12;
  }
}

/**
 * Devuelve true si el fijo (definido por startMonth y frequency) aparece en el mes dado.
 * Precondición: startMonth <= month (el caller ya verificó el rango y deletedFrom).
 *
 * La condición de frecuencia: monthDiff(startMonth, month) % step === 0
 * Ejemplos:
 *   startMonth='2026-03', BIMONTHLY, month='2026-05' → diff=2, 2%2=0 → true
 *   startMonth='2026-03', BIMONTHLY, month='2026-04' → diff=1, 1%2=1 → false
 *   startMonth='2026-01', QUARTERLY, month='2026-04' → diff=3, 3%3=0 → true
 */
export function isOnFrequency(
  startMonth: string,
  frequency: RecurringFrequency,
  month: string,
): boolean {
  const diff = monthDiff(startMonth, month);
  const step = frequencyStep(frequency);
  return diff % step === 0;
}

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
