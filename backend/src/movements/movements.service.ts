import { BadRequestException, Injectable } from '@nestjs/common';
import { FormulaOperator, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsRepository,
  MovementItem,
  AnnualCategoryMeta,
  RecurringForAnnual,
  addMonths,
  isOnFrequency,
} from './movements.repository';
import { applyFormula } from '../recurring/formula.helper';

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
 * Shape de una entrada mensual en la respuesta de reportes.
 */
export interface ReportMonth {
  month: string; // YYYY-MM
  incomeCents: number;
  expenseCents: number;
}

/**
 * Shape de una categoría con gasto en la respuesta de reportes.
 */
export interface ReportCategory {
  categoryId: string;
  name: string;
  color: string;
  monthlyExpenseCents: number[];
}

/**
 * Shape completo de la respuesta de GET /movements/reports.
 */
export interface ReportsMovementsResponse {
  year: number;
  months: ReportMonth[];
  categories: ReportCategory[];
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
   * Filtro de categorías (Fase 1.1.6):
   * - categoryIds === null: sin filtro, todas las categorías.
   * - categoryIds === []: ninguna → listas vacías y totales en cero.
   * - categoryIds = ["id1","id2"]: solo esas categorías.
   *
   * Totales (RN-019 — Fase 1.1.7):
   * Los calculados suman con su signo al bucket de su propio type (amountCents puede ser negativo).
   * Los fijos skippeados (incluidos calculados cuyo origen está skippeado) no suman.
   */
  async getMonthMovements(
    userId: string,
    month: string,
    categoryIds: string[] | null = null,
  ): Promise<MonthMovementsResponse> {
    this.validateMonth(month);

    // Estado "ninguna": atajar antes de cualquier consulta al repositorio
    if (categoryIds !== null && categoryIds.length === 0) {
      this.logger.debug(
        { userId, month, filter: 'ninguna' },
        'Movimientos del mes: filtro vacío → resultado vacío',
      );
      return {
        month,
        totals: { expenseCents: 0, incomeCents: 0, balanceCents: 0 },
        movements: { unicos: [], fijos: [], cuotas: [] },
      };
    }

    const [unicos, fijos, cuotas] = await Promise.all([
      this.repo.findUnicosByMonth(userId, month),
      this.repo.findFijosByMonth(userId, month),
      this.repo.findCuotasByMonth(userId, month),
    ]);

    // Aplicar filtro de categorías
    const filterSet = categoryIds !== null ? new Set(categoryIds) : null;

    const unicosFiltrados =
      filterSet !== null
        ? unicos.filter((u) => filterSet.has(u.category.id))
        : unicos;

    const fijosFiltrados =
      filterSet !== null
        ? fijos.filter((f) => filterSet.has(f.category.id))
        : fijos;

    const cuotasFiltradas =
      filterSet !== null
        ? cuotas.filter((c) => filterSet.has(c.category.id))
        : cuotas;

    // Calcular totales desde las listas filtradas.
    // RN-019: sumar la MAGNITUD (|amountCents|) al bucket del type derivado.
    // Para únicos y fijos normales amountCents > 0 (magnitud == valor).
    // Para calculados (Fase 1.1.7) amountCents puede ser negativo o cero (RN-018);
    // el type ya viene derivado del signo en el MovementItem → usar |amountCents|.
    // Fijos skippeados (y calculados cuyo origen está skippeado) no suman.
    const unicosExpense = unicosFiltrados
      .filter((u) => u.type === 'EXPENSE')
      .reduce((sum, u) => sum + Math.abs(u.amountCents), 0);
    const unicosIncome = unicosFiltrados
      .filter((u) => u.type === 'INCOME')
      .reduce((sum, u) => sum + Math.abs(u.amountCents), 0);

    const fijosExpense = fijosFiltrados
      .filter((f) => !f.skipped && f.type === 'EXPENSE')
      .reduce((sum, f) => sum + Math.abs(f.amountCents), 0);
    const fijosIncome = fijosFiltrados
      .filter((f) => !f.skipped && f.type === 'INCOME')
      .reduce((sum, f) => sum + Math.abs(f.amountCents), 0);

    const cuotasExpense = cuotasFiltradas
      .filter((c) => c.type === 'EXPENSE')
      .reduce((sum, c) => sum + c.amountCents, 0);
    const cuotasIncome = cuotasFiltradas
      .filter((c) => c.type === 'INCOME')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const expenseCents = unicosExpense + fijosExpense + cuotasExpense;
    const incomeCents = unicosIncome + fijosIncome + cuotasIncome;

    const totals: MonthTotals = {
      expenseCents,
      incomeCents,
      balanceCents: incomeCents - expenseCents,
    };

    this.logger.debug(
      {
        userId,
        month,
        filterCount: filterSet?.size ?? null,
        unicosCount: unicosFiltrados.length,
        fijosCount: fijosFiltrados.length,
        cuotasCount: cuotasFiltradas.length,
        totals,
      },
      'Movimientos del mes listados',
    );

    return {
      month,
      totals,
      movements: {
        unicos: unicosFiltrados,
        fijos: fijosFiltrados,
        cuotas: cuotasFiltradas,
      },
    };
  }

  /**
   * Devuelve la serie de reportes anual de movimientos del usuario para el año dado.
   *
   * Fase 1.1.7 — calculados en reportes:
   * Para cada fijo calculado activo en cada mes del año, se deriva el monto on-the-fly
   * usando la misma lógica que el mensual. Se suma con signo al bucket del propio type.
   *
   * Filtro de categorías (Fase 1.1.5):
   * - null/undefined = todas.
   * - [] = ninguna (resultado vacío/cero).
   * - [...ids] = subconjunto.
   *
   * CRÍTICO: earliestYear ignora el filtro.
   */
  async getReportsMovements(
    userId: string,
    year: number,
    categoryIds?: string[] | null,
  ): Promise<ReportsMovementsResponse> {
    // Normalizar el filtro de categorías
    const EMPTY_SET = new Set<string>();
    const filterSet: Set<string> | null =
      categoryIds === null || categoryIds === undefined
        ? null
        : categoryIds.length === 0
          ? EMPTY_SET
          : new Set(categoryIds);

    const yearStr = String(year).padStart(4, '0');
    const months12: string[] = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${yearStr}-${m}`;
    });

    const monthIndex = (monthKey: string): number => {
      const mNum = parseInt(monthKey.split('-')[1], 10);
      return mNum - 1;
    };

    const agg: {
      incomeCents: number;
      expenseCents: number;
      categoryExpense: Map<string, number>;
    }[] = Array.from({ length: 12 }, () => ({
      incomeCents: 0,
      expenseCents: 0,
      categoryExpense: new Map<string, number>(),
    }));

    const catMeta = new Map<string, AnnualCategoryMeta>();

    // 1. Únicos
    const unicosRows = await this.repo.getAnnualUnicosAggregated(userId, year);

    for (const row of unicosRows) {
      if (filterSet !== null && !filterSet.has(row.categoryId)) continue;

      const idx = monthIndex(row.monthKey);
      if (idx < 0 || idx > 11) continue;

      const cents = Number(row.totalCents);

      if (row.type === 'INCOME') {
        agg[idx].incomeCents += cents;
      } else {
        agg[idx].expenseCents += cents;
        const prev = agg[idx].categoryExpense.get(row.categoryId) ?? 0;
        agg[idx].categoryExpense.set(row.categoryId, prev + cents);
      }

      if (!catMeta.has(row.categoryId)) {
        catMeta.set(row.categoryId, {
          categoryId: row.categoryId,
          name: row.categoryName,
          color: row.categoryColor,
        });
      }
    }

    // 2. Fijos (incluye calculados — Fase 1.1.7)
    const allFijos = await this.repo.getAllFijosForAnnual(userId);

    // Construir mapa chainId → fijo para la resolución del origen de calculados
    // Un fijo puede tener múltiples filas en la cadena; para cada mes tomamos
    // la fila con startMonth más alto que sea activa en ese mes.
    // Indexamos todas las filas normales por chainId para lookup rápido.
    const normalesForAnnual = allFijos.filter((f) => f.sourceChainId === null);
    const calculadosForAnnual = allFijos.filter((f) => f.sourceChainId !== null);

    for (let i = 0; i < 12; i++) {
      const mes = months12[i];

      // Construir mapa chainId → datos del normal activo en este mes.
      // La invariante del split garantiza que para cualquier mes dado, a lo sumo UNA fila
      // por cadena pasa los filtros inRange+isOnFrequency (los rangos de splits no se solapan).
      // El desempate por startMonth más alto es una red de seguridad para datos atípicos.
      const normalesActivosMes = new Map<string, { amountCents: number; skipped: boolean; startMonth: string }>();
      for (const fijo of normalesForAnnual) {
        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;

        // Red de seguridad: si hubiera dos filas de la misma cadena activas en el mismo mes
        // (estado anómalo), tomamos la de mayor startMonth (la más reciente).
        const existing = normalesActivosMes.get(fijo.chainId);
        if (!existing || fijo.startMonth > existing.startMonth) {
          normalesActivosMes.set(fijo.chainId, {
            amountCents: fijo.amountCents,
            skipped: fijo.skippedMonths.has(mes),
            startMonth: fijo.startMonth,
          });
        }
      }

      // Procesar fijos normales
      for (const fijo of normalesForAnnual) {
        if (filterSet !== null && !filterSet.has(fijo.categoryId)) continue;

        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;
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

      // Procesar calculados (Fase 1.1.7)
      for (const calc of calculadosForAnnual) {
        if (filterSet !== null && !filterSet.has(calc.categoryId)) continue;

        // Verificar rango propio del calculado (startMonth/deletedFrom).
        // NO se aplica isOnFrequency al calculado: su presencia está gate-ada
        // enteramente por el origen (normalesActivosMes). Aplicar isOnFrequency
        // con el startMonth del calculado puede causar desalineamiento con el
        // origen cuando la frecuencia tiene step > 1 y el startMonth del
        // calculado no está alineado con el del origen.
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        // El calculado hereda el gating y skip del origen
        const originData = calc.sourceChainId
          ? normalesActivosMes.get(calc.sourceChainId)
          : undefined;
        if (!originData) continue; // origen no activo en este mes
        if (originData.skipped) continue; // heredar skip del origen

        const derivedAmount = applyFormula(
          originData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );

        // Derivar el type del signo del monto (RF-MCALC-003, RN-018):
        // final < 0 → EXPENSE; final > 0 → INCOME; final == 0 → EXPENSE (convención de borde)
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        // RN-019: sumar la MAGNITUD (|amountCents|) al bucket del type derivado.
        // El amountCents puede ser negativo (RN-018), pero los totales siempre suman
        // magnitudes (nunca restan): un calculado EXPENSE de -2000 suma 2000 a expenseCents.
        const magnitude = Math.abs(derivedAmount);

        if (derivedType === MovementType.INCOME) {
          agg[i].incomeCents += magnitude;
        } else {
          // EXPENSE: suma magnitud (no el valor firmado)
          agg[i].expenseCents += magnitude;
          const prev = agg[i].categoryExpense.get(calc.categoryId) ?? 0;
          agg[i].categoryExpense.set(calc.categoryId, prev + magnitude);
        }

        if (!catMeta.has(calc.categoryId) && derivedType === MovementType.EXPENSE) {
          catMeta.set(calc.categoryId, {
            categoryId: calc.categoryId,
            name: calc.categoryName,
            color: calc.categoryColor,
          });
        }
      }
    }

    // 3. Cuotas
    const cuotas = await this.repo.getAllCuotasForAnnual(userId);

    for (const grupo of cuotas) {
      if (filterSet !== null && !filterSet.has(grupo.categoryId)) continue;

      const endMonth = addMonths(grupo.startMonth, grupo.totalInstallments);

      for (let i = 0; i < 12; i++) {
        const mes = months12[i];
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

    // 4. Armar el array months (siempre 12 entradas)
    const monthsResult: ReportMonth[] = months12.map((month, i) => ({
      month,
      incomeCents: agg[i].incomeCents,
      expenseCents: agg[i].expenseCents,
    }));

    // 5. Armar el array categories
    const categoriesResult: ReportCategory[] = [];

    for (const [catId, meta] of catMeta) {
      const monthly: number[] = Array.from(
        { length: 12 },
        (_, i) => agg[i].categoryExpense.get(catId) ?? 0,
      );
      const totalAnnual = monthly.reduce((sum, v) => sum + v, 0);

      if (totalAnnual === 0) continue;

      categoriesResult.push({
        categoryId: catId,
        name: meta.name,
        color: meta.color,
        monthlyExpenseCents: monthly,
      });
    }

    categoriesResult.sort((a, b) => {
      const totalA = a.monthlyExpenseCents.reduce((s, v) => s + v, 0);
      const totalB = b.monthlyExpenseCents.reduce((s, v) => s + v, 0);
      if (totalB !== totalA) return totalB - totalA;
      return a.categoryId.localeCompare(b.categoryId);
    });

    // 6. Año más antiguo (ignora el filtro)
    const earliestYear = await this.repo.getEarliestYear(userId);

    this.logger.debug(
      {
        userId,
        year,
        filterCount: filterSet?.size ?? null,
        monthsWithData: monthsResult.filter(
          (m) => m.incomeCents > 0 || m.expenseCents > 0,
        ).length,
        categoriesCount: categoriesResult.length,
        earliestYear,
      },
      'Serie de reportes de movimientos calculada',
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
