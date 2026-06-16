import { BadRequestException, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import {
  MovementsRepository,
  MovementItem,
  AnnualCategoryMeta,
  addMonths,
  isOnFrequency,
} from './movements.repository';

/**
 * Shape de los totales del mes.
 * Suma movimientos únicos + fijos activos + cuotas activas en el mes.
 */
export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  balanceCents: number;
}

/**
 * Shape completo de la respuesta de GET /movements.
 *
 * - `unicos`: movimientos únicos del mes (poblado desde Fase 5)
 * - `fijos`: fijos activos en el mes (poblado desde Fase 6)
 * - `cuotas`: cuotas que caen en el mes (poblado desde Fase 7)
 */
export interface MonthMovementsResponse {
  month: string;
  totals: MonthTotals;
  movements: {
    unicos: MovementItem[];
    fijos: MovementItem[];
    cuotas: MovementItem[];
  };
}

/**
 * Shape de una entrada mensual en la respuesta anual.
 */
export interface AnnualMonthEntry {
  month: string; // YYYY-MM
  incomeCents: number;
  expenseCents: number;
}

/**
 * Shape de una categoría con gasto en la respuesta anual.
 * monthlyExpenseCents tiene exactamente 12 posiciones (ene→dic).
 */
export interface AnnualCategoryEntry {
  categoryId: string;
  name: string;
  color: string;
  monthlyExpenseCents: number[];
}

/**
 * Shape completo de la respuesta de GET /movements/annual.
 */
export interface AnnualMovementsResponse {
  year: number;
  months: AnnualMonthEntry[];
  categories: AnnualCategoryEntry[];
  earliestYear: number | null;
}

@Injectable()
export class MovementsService {
  constructor(
    private readonly repo: MovementsRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Devuelve los movimientos del mes YYYY-MM para el usuario dado.
   *
   * Bucketeo de únicos: por la timezone propia de CADA registro (AT TIME ZONE t.timezone),
   * implementado en SQL raw en MovementsRepository.
   * Bucketeo de fijos: comparación léxica de strings YYYY-MM (no requiere timezone).
   * Bucketeo de cuotas: comparación léxica de strings YYYY-MM + cálculo on-the-fly en JS.
   *
   * Validación: month obligatorio y con formato YYYY-MM. Si falta o es inválido → 400.
   * No requiere ni acepta timezone en el query param.
   *
   * Totales: suman movimientos únicos + fijos activos + cuotas activas del mes.
   *
   * @param userId  userId del JWT (RN-003: aislamiento por usuario)
   * @param month   Mes en formato YYYY-MM
   */
  async getMonthMovements(
    userId: string,
    month: string,
  ): Promise<MonthMovementsResponse> {
    // Validar formato y semántica del mes
    this.validateMonth(month);

    // Obtener movimientos y totales en paralelo para eficiencia
    const [
      unicos,
      fijos,
      cuotas,
      rawTotalsUnicos,
      rawTotalsFijos,
      rawTotalsCuotas,
    ] = await Promise.all([
      this.repo.findUnicosByMonth(userId, month),
      this.repo.findFijosByMonth(userId, month),
      this.repo.findCuotasByMonth(userId, month),
      this.repo.getTotalsByMonth(userId, month),
      this.repo.getFijosTotalsByMonth(userId, month),
      this.repo.getCuotasTotalsByMonth(userId, month),
    ]);

    // Combinar totales de únicos + fijos + cuotas
    const expenseCents =
      rawTotalsUnicos.expenseCents +
      rawTotalsFijos.expenseCents +
      rawTotalsCuotas.expenseCents;
    const incomeCents =
      rawTotalsUnicos.incomeCents +
      rawTotalsFijos.incomeCents +
      rawTotalsCuotas.incomeCents;

    const totals: MonthTotals = {
      expenseCents,
      incomeCents,
      balanceCents: incomeCents - expenseCents,
    };

    this.logger.debug(
      {
        userId,
        month,
        unicosCount: unicos.length,
        fijosCount: fijos.length,
        cuotasCount: cuotas.length,
        totals,
      },
      'Movimientos del mes listados',
    );

    return {
      month,
      totals,
      movements: {
        unicos,
        fijos,
        cuotas,
      },
    };
  }

  /**
   * Devuelve la agregación anual de movimientos del usuario para el año dado.
   *
   * Criterio de imputación por mes (RN-015):
   * - Únicos: mes calculado con AT TIME ZONE propia de cada registro (igual que /movements).
   * - Fijos: activos en cada mes del año según startMonth y deletedFrom (comparación léxica YYYY-MM).
   * - Cuotas: activas en cada mes del año según startMonth y totalInstallments (on-the-fly).
   *
   * Validación: year obligatorio, exactamente 4 dígitos YYYY, valor entre 1900 y 2200.
   *
   * @param userId userId del JWT (RN-003)
   * @param year   Año en formato YYYY
   */
  async getAnnualMovements(
    userId: string,
    year: number,
  ): Promise<AnnualMovementsResponse> {
    // Validación ya ejecutada en el controller; el service recibe el número directamente.
    // (La validación de formato YYYY se hace en el controller antes de llamar acá.)

    // Los 12 meses del año como strings "YYYY-MM"
    const yearStr = String(year).padStart(4, '0');
    const months12: string[] = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${yearStr}-${m}`;
    });

    // Índice de mes dentro del año: "YYYY-01" → 0, "YYYY-12" → 11
    const monthIndex = (monthKey: string): number => {
      const mNum = parseInt(monthKey.split('-')[1], 10);
      return mNum - 1;
    };

    // Acumuladores: un MonthAggregate por mes (índice 0..11)
    const agg: {
      incomeCents: number;
      expenseCents: number;
      categoryExpense: Map<string, number>;
    }[] = Array.from({ length: 12 }, () => ({
      incomeCents: 0,
      expenseCents: 0,
      categoryExpense: new Map<string, number>(),
    }));

    // Mapa de metadatos de categoría: id → { id, name, color }
    const catMeta = new Map<string, AnnualCategoryMeta>();

    // -------------------------------------------------------------------------
    // 1. Únicos — query SQL agregada por (mes local, categoryId, type)
    // -------------------------------------------------------------------------
    const unicosRows = await this.repo.getAnnualUnicosAggregated(userId, year);

    for (const row of unicosRows) {
      const idx = monthIndex(row.monthKey);
      if (idx < 0 || idx > 11) continue; // no debería pasar, pero por robustez

      const cents = Number(row.totalCents);

      if (row.type === 'INCOME') {
        agg[idx].incomeCents += cents;
      } else {
        // EXPENSE
        agg[idx].expenseCents += cents;
        // Acumular por categoría
        const prev = agg[idx].categoryExpense.get(row.categoryId) ?? 0;
        agg[idx].categoryExpense.set(row.categoryId, prev + cents);
      }

      // Registrar metadato de categoría (se sobreescribe pero es idempotente)
      if (!catMeta.has(row.categoryId)) {
        catMeta.set(row.categoryId, {
          categoryId: row.categoryId,
          name: row.categoryName,
          color: row.categoryColor,
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. Fijos — traer todos y proyectar sobre los 12 meses del año
    //    Condición de actividad:
    //      startMonth <= mes AND (deletedFrom IS NULL OR deletedFrom > mes)
    //      AND isOnFrequency(startMonth, frequency, mes)   [P2 — Fase 1.1.1]
    //    Los meses skippeados (P1 — Fase 1.1.1) NO suman a los totales:
    //      mes en fijo.skippedMonths → excluir del cálculo.
    //    Comparación léxica YYYY-MM (RN-015, igual que el endpoint mensual).
    // -------------------------------------------------------------------------
    const fijos = await this.repo.getAllFijosForAnnual(userId);

    for (const fijo of fijos) {
      for (let i = 0; i < 12; i++) {
        const mes = months12[i];

        // Condición de actividad: rango léxico
        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);

        if (!inRange) continue;

        // Condición de frecuencia (P2)
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;

        // Excluir meses skippeados de los totales (P1)
        // (el ítem se muestra en la lista mensual con skipped=true, pero no suma al anual)
        if (fijo.skippedMonths.has(mes)) continue;

        if (fijo.type === 'INCOME') {
          agg[i].incomeCents += fijo.amountCents;
        } else {
          agg[i].expenseCents += fijo.amountCents;
          const prev = agg[i].categoryExpense.get(fijo.categoryId) ?? 0;
          agg[i].categoryExpense.set(fijo.categoryId, prev + fijo.amountCents);
        }

        if (!catMeta.has(fijo.categoryId) && fijo.type === 'EXPENSE') {
          catMeta.set(fijo.categoryId, {
            categoryId: fijo.categoryId,
            name: fijo.categoryName,
            color: fijo.categoryColor,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Cuotas — traer todos los grupos y proyectar on-the-fly sobre los 12 meses
    //    Actividad: startMonth <= mes AND mes < addMonths(startMonth, totalInstallments)
    //    (RN-015, RN-006, igual que el endpoint mensual)
    // -------------------------------------------------------------------------
    const cuotas = await this.repo.getAllCuotasForAnnual(userId);

    for (const grupo of cuotas) {
      const endMonth = addMonths(grupo.startMonth, grupo.totalInstallments);

      for (let i = 0; i < 12; i++) {
        const mes = months12[i];
        // Activo si: startMonth <= mes AND mes < endMonth
        if (grupo.startMonth > mes || mes >= endMonth) continue;

        if (grupo.type === 'INCOME') {
          agg[i].incomeCents += grupo.amountCents;
        } else {
          agg[i].expenseCents += grupo.amountCents;
          const prev = agg[i].categoryExpense.get(grupo.categoryId) ?? 0;
          agg[i].categoryExpense.set(
            grupo.categoryId,
            prev + grupo.amountCents,
          );
        }

        if (!catMeta.has(grupo.categoryId) && grupo.type === 'EXPENSE') {
          catMeta.set(grupo.categoryId, {
            categoryId: grupo.categoryId,
            name: grupo.categoryName,
            color: grupo.categoryColor,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. Armar el array months (siempre 12 entradas)
    // -------------------------------------------------------------------------
    const monthsResult: AnnualMonthEntry[] = months12.map((month, i) => ({
      month,
      incomeCents: agg[i].incomeCents,
      expenseCents: agg[i].expenseCents,
    }));

    // -------------------------------------------------------------------------
    // 5. Armar el array categories
    //    Solo categorías con algún gasto en el año (EXPENSE).
    //    monthlyExpenseCents: 12 valores (ene→dic), en cero donde no hay gasto.
    //    Orden: gasto anual total DESC; desempate por categoryId ASC (determinístico).
    //
    //    Invariante: SUM(categories[i].monthlyExpenseCents[m]) == months[m].expenseCents
    //    para todo mes m. Se cumple porque tanto monthsResult como categoryExpense
    //    acumulan los mismos valores en los mismos buckets.
    // -------------------------------------------------------------------------
    const categoriesResult: AnnualCategoryEntry[] = [];

    for (const [catId, meta] of catMeta) {
      // Verificar que tiene al menos algún gasto en el año
      const monthly: number[] = Array.from(
        { length: 12 },
        (_, i) => agg[i].categoryExpense.get(catId) ?? 0,
      );
      const totalAnnual = monthly.reduce((sum, v) => sum + v, 0);

      if (totalAnnual === 0) continue; // no tiene gasto real en el año (solo income)

      categoriesResult.push({
        categoryId: catId,
        name: meta.name,
        color: meta.color,
        monthlyExpenseCents: monthly,
      });
    }

    // Ordenar: gasto anual total DESC; desempate por categoryId ASC
    categoriesResult.sort((a, b) => {
      const totalA = a.monthlyExpenseCents.reduce((s, v) => s + v, 0);
      const totalB = b.monthlyExpenseCents.reduce((s, v) => s + v, 0);
      if (totalB !== totalA) return totalB - totalA;
      return a.categoryId.localeCompare(b.categoryId);
    });

    // -------------------------------------------------------------------------
    // 6. Año más antiguo con movimientos del usuario
    // -------------------------------------------------------------------------
    const earliestYear = await this.repo.getEarliestYear(userId);

    this.logger.debug(
      {
        userId,
        year,
        monthsWithData: monthsResult.filter(
          (m) => m.incomeCents > 0 || m.expenseCents > 0,
        ).length,
        categoriesCount: categoriesResult.length,
        earliestYear,
      },
      'Agregación anual de movimientos calculada',
    );

    return {
      year,
      months: monthsResult,
      categories: categoriesResult,
      earliestYear,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Valida que el mes tenga formato YYYY-MM y un valor de mes entre 01 y 12.
   * @throws BadRequestException si el formato es inválido.
   */
  private validateMonth(month: string): void {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El parámetro "month" es obligatorio y debe tener formato YYYY-MM (ej: 2026-06)',
      );
    }

    const monthNum = parseInt(month.split('-')[1], 10);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException(
        'El mes debe estar entre 01 y 12',
      );
    }
  }
}
