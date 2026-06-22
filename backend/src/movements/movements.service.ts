import { BadRequestException, Injectable } from '@nestjs/common';
import { Currency, FormulaOperator, MovementType } from '@prisma/client';
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
import { convertToDisplayCurrency, PivotRates, buildPivotRates } from '../common/currency.helper';
import { SettingsService } from '../settings/settings.service';

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
 * Shape de una categoría disponible (universo estable del año, SIN aplicar filtro).
 * Metadata liviana: sin breakdown mensual.
 */
export interface AvailableCategory {
  categoryId: string;
  name: string;
  color: string;
}

/**
 * Shape completo de la respuesta de GET /movements/reports.
 */
export interface ReportsMovementsResponse {
  year: number;
  months: ReportMonth[];
  categories: ReportCategory[];
  availableCategories: AvailableCategory[];
  earliestYear: number | null;
}

@Injectable()
export class MovementsService {
  constructor(
    private readonly repo: MovementsRepository,
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
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

    // Cargar la moneda default del usuario (Fase 1.2.3)
    const userSettings = await this.settingsService.getSettings(userId);
    const defaultCurrency = userSettings.defaultCurrency;

    const [unicos, fijos, cuotas] = await Promise.all([
      this.repo.findUnicosByMonth(userId, month, defaultCurrency),
      this.repo.findFijosByMonth(userId, month, defaultCurrency),
      this.repo.findCuotasByMonth(userId, month, defaultCurrency),
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
    // Fase 1.2.3: usar convertedAmountCents (ya convertido a la moneda default del usuario).
    // RN-019: sumar la MAGNITUD al bucket del type derivado.
    // Para calculados (Fase 1.1.7) amountCents puede ser negativo o cero (RN-018);
    // el type ya viene derivado del signo en el MovementItem.
    // Fijos skippeados (y calculados cuyo origen está skippeado) no suman.
    const unicosExpense = unicosFiltrados
      .filter((u) => u.type === 'EXPENSE')
      .reduce((sum, u) => sum + u.convertedAmountCents, 0);
    const unicosIncome = unicosFiltrados
      .filter((u) => u.type === 'INCOME')
      .reduce((sum, u) => sum + u.convertedAmountCents, 0);

    const fijosExpense = fijosFiltrados
      .filter((f) => !f.skipped && f.type === 'EXPENSE')
      .reduce((sum, f) => sum + f.convertedAmountCents, 0);
    const fijosIncome = fijosFiltrados
      .filter((f) => !f.skipped && f.type === 'INCOME')
      .reduce((sum, f) => sum + f.convertedAmountCents, 0);

    const cuotasExpense = cuotasFiltradas
      .filter((c) => c.type === 'EXPENSE')
      .reduce((sum, c) => sum + c.convertedAmountCents, 0);
    const cuotasIncome = cuotasFiltradas
      .filter((c) => c.type === 'INCOME')
      .reduce((sum, c) => sum + c.convertedAmountCents, 0);

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
   * Override de moneda (P3):
   * - currencyOverride presente → displayCurrency = currencyOverride.
   * - currencyOverride ausente/undefined → displayCurrency = userSettings.defaultCurrency.
   * El shape de la respuesta no cambia: la serie ya viene convertida.
   *
   * CRÍTICO: earliestYear ignora el filtro.
   */
  async getReportsMovements(
    userId: string,
    year: number,
    categoryIds?: string[] | null,
    currencyOverride?: Currency | null,
  ): Promise<ReportsMovementsResponse> {
    // Normalizar el filtro de categorías
    const EMPTY_SET = new Set<string>();
    const filterSet: Set<string> | null =
      categoryIds === null || categoryIds === undefined
        ? null
        : categoryIds.length === 0
          ? EMPTY_SET
          : new Set(categoryIds);

    // Cargar la moneda default del usuario y las pivot rates del año en paralelo (Fase 1.2.4)
    const [userSettings, pivotRatesForYear] = await Promise.all([
      this.settingsService.getSettings(userId),
      this.repo.loadPivotRatesForYear(year),
    ]);
    // P3: si viene currencyOverride usa esa moneda; si no, la default del usuario.
    const displayCurrency: Currency =
      currencyOverride != null ? currencyOverride : userSettings.defaultCurrency;

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

    // Universo estable de categorías: calculado SIN aplicar filterSet.
    // Se usa para poblar availableCategories en la respuesta.
    const catMetaAll = new Map<string, AnnualCategoryMeta>();
    // Gasto anual por categoría SIN filtro (para ordenar availableCategories).
    const annualExpenseAll = new Map<string, number>();

    // 1. Únicos
    const unicosRows = await this.repo.getAnnualUnicosAggregated(userId, year);

    for (const row of unicosRows) {
      const idx = monthIndex(row.monthKey);
      if (idx < 0 || idx > 11) continue;

      // Fase 1.2.4: re-rutear vía pivot rates del mes del movimiento
      const pivotRates = pivotRatesForYear.get(row.monthKey) ?? null;
      const rawCents = Number(row.totalCents);
      const cents = convertToDisplayCurrency(
        rawCents,
        row.currency as Currency,
        Number(row.exchangeRate),
        row.anchorCurrency as Currency,
        displayCurrency,
        pivotRates,
      );

      // Acumular en el universo estable (sin filtro) para EXPENSE
      if (row.type === 'EXPENSE') {
        if (!catMetaAll.has(row.categoryId)) {
          catMetaAll.set(row.categoryId, {
            categoryId: row.categoryId,
            name: row.categoryName,
            color: row.categoryColor,
          });
        }
        annualExpenseAll.set(
          row.categoryId,
          (annualExpenseAll.get(row.categoryId) ?? 0) + cents,
        );
      }

      if (filterSet !== null && !filterSet.has(row.categoryId)) continue;

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

    // 2. Fijos (incluye calculados — Fase 1.1.7 + 1.1.7.ext)
    const allFijos = await this.repo.getAllFijosForAnnual(userId);

    // Separar en normales y tres tipos de calculados
    const normalesForAnnual = allFijos.filter(
      (f) => f.sourceChainId === null && f.sourceMovementId === null && f.sourceInstallmentGroupId === null,
    );
    const calculadosDeFijoAnual = allFijos.filter((f) => f.sourceChainId !== null);
    const calculadosDeUnicoAnual = allFijos.filter((f) => f.sourceMovementId !== null);
    const calculadosDeCuotaAnual = allFijos.filter((f) => f.sourceInstallmentGroupId !== null);

    // Cargar todos los Transactions de origen para calculados de único (una sola query)
    const txIdsAnual = [...new Set(calculadosDeUnicoAnual.map((f) => f.sourceMovementId!).filter(Boolean))];
    const txAnualMap = new Map<string, { amountCents: number; description: string | null; currency: Currency; exchangeRate: number; anchorCurrency: Currency }>();
    if (txIdsAnual.length > 0) {
      const txRows = await this.repo.findTransactionsByIds(txIdsAnual);
      for (const tx of txRows) txAnualMap.set(tx.id, {
        amountCents: tx.amountCents,
        description: tx.description,
        currency: tx.currency,
        exchangeRate: tx.exchangeRate,
        anchorCurrency: tx.anchorCurrency,
      });
    }

    // Cargar todos los InstallmentGroups de origen para calculados de cuota (una sola query)
    const groupIdsAnual = [...new Set(calculadosDeCuotaAnual.map((f) => f.sourceInstallmentGroupId!).filter(Boolean))];
    const groupAnualMap = new Map<string, {
      amountCents: number;
      totalInstallments: number;
      startMonth: string;
      currency: Currency;
      exchangeRate: number;
      anchorCurrency: Currency;
    }>();
    if (groupIdsAnual.length > 0) {
      const groupRows = await this.repo.findInstallmentGroupsByIds(groupIdsAnual);
      for (const g of groupRows) groupAnualMap.set(g.id, {
        amountCents: g.amountCents,
        totalInstallments: g.totalInstallments,
        startMonth: g.startMonth,
        currency: g.currency,
        exchangeRate: g.exchangeRate,
        anchorCurrency: g.anchorCurrency,
      });
    }

    for (let i = 0; i < 12; i++) {
      const mes = months12[i];
      // Pivot rates del mes (para re-rutear la conversión si anchorCurrency ≠ displayCurrency)
      const pivotRates = pivotRatesForYear.get(mes) ?? null;

      // Construir mapa chainId → datos del normal activo en este mes.
      const normalesActivosMes = new Map<string, {
        amountCents: number;
        skipped: boolean;
        startMonth: string;
        currency: Currency;
        exchangeRate: number;
        anchorCurrency: Currency;
      }>();
      for (const fijo of normalesForAnnual) {
        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;

        const existing = normalesActivosMes.get(fijo.chainId);
        if (!existing || fijo.startMonth > existing.startMonth) {
          normalesActivosMes.set(fijo.chainId, {
            amountCents: fijo.amountCents,
            skipped: fijo.skippedMonths.has(mes),
            startMonth: fijo.startMonth,
            currency: fijo.currency,
            exchangeRate: fijo.exchangeRate,
            anchorCurrency: fijo.anchorCurrency,
          });
        }
      }

      // Procesar fijos normales
      for (const fijo of normalesForAnnual) {
        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;
        if (fijo.skippedMonths.has(mes)) continue;

        // Fase 1.2.4: re-rutear vía pivot rates del mes
        const convertedAmount = convertToDisplayCurrency(
          fijo.amountCents,
          fijo.currency,
          fijo.exchangeRate,
          fijo.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        // Acumular en el universo estable (sin filtro) para EXPENSE
        if (fijo.type === 'EXPENSE') {
          if (!catMetaAll.has(fijo.categoryId)) {
            catMetaAll.set(fijo.categoryId, {
              categoryId: fijo.categoryId,
              name: fijo.categoryName,
              color: fijo.categoryColor,
            });
          }
          annualExpenseAll.set(
            fijo.categoryId,
            (annualExpenseAll.get(fijo.categoryId) ?? 0) + convertedAmount,
          );
        }

        if (filterSet !== null && !filterSet.has(fijo.categoryId)) continue;

        if (fijo.type === 'INCOME') {
          agg[i].incomeCents += convertedAmount;
        } else {
          agg[i].expenseCents += convertedAmount;
          const prev = agg[i].categoryExpense.get(fijo.categoryId) ?? 0;
          agg[i].categoryExpense.set(fijo.categoryId, prev + convertedAmount);
        }

        if (!catMeta.has(fijo.categoryId) && fijo.type === 'EXPENSE') {
          catMeta.set(fijo.categoryId, {
            categoryId: fijo.categoryId,
            name: fijo.categoryName,
            color: fijo.categoryColor,
          });
        }
      }

      // Procesar calculados de fijo (Fase 1.1.7)
      for (const calc of calculadosDeFijoAnual) {
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const originData = calc.sourceChainId
          ? normalesActivosMes.get(calc.sourceChainId)
          : undefined;
        if (!originData) continue;
        if (originData.skipped) continue;

        const derivedAmount = applyFormula(
          originData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        // Calculados heredan moneda/cotización/anchor del origen; re-rutear vía pivot rates
        const magnitude = convertToDisplayCurrency(
          Math.abs(derivedAmount),
          originData.currency,
          originData.exchangeRate,
          originData.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        // Acumular en el universo estable (sin filtro) para EXPENSE
        if (derivedType === MovementType.EXPENSE) {
          if (!catMetaAll.has(calc.categoryId)) {
            catMetaAll.set(calc.categoryId, {
              categoryId: calc.categoryId,
              name: calc.categoryName,
              color: calc.categoryColor,
            });
          }
          annualExpenseAll.set(
            calc.categoryId,
            (annualExpenseAll.get(calc.categoryId) ?? 0) + magnitude,
          );
        }

        if (filterSet !== null && !filterSet.has(calc.categoryId)) continue;

        if (derivedType === MovementType.INCOME) {
          agg[i].incomeCents += magnitude;
        } else {
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

      // Procesar calculados de único (Fase 1.1.7.ext)
      // El rango ya está autolimitado (1 mes), así que el inRange garantiza que solo aparece
      // en el mes del único. No hay skip (los únicos no tienen skip).
      for (const calc of calculadosDeUnicoAnual) {
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const txData = calc.sourceMovementId ? txAnualMap.get(calc.sourceMovementId) : undefined;
        if (!txData) continue;

        const derivedAmount = applyFormula(
          txData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        // Calculados heredan moneda/cotización/anchor del origen; re-rutear vía pivot rates
        const magnitude = convertToDisplayCurrency(
          Math.abs(derivedAmount),
          txData.currency,
          txData.exchangeRate,
          txData.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        // Acumular en el universo estable (sin filtro) para EXPENSE
        if (derivedType === MovementType.EXPENSE) {
          if (!catMetaAll.has(calc.categoryId)) {
            catMetaAll.set(calc.categoryId, {
              categoryId: calc.categoryId,
              name: calc.categoryName,
              color: calc.categoryColor,
            });
          }
          annualExpenseAll.set(
            calc.categoryId,
            (annualExpenseAll.get(calc.categoryId) ?? 0) + magnitude,
          );
        }

        if (filterSet !== null && !filterSet.has(calc.categoryId)) continue;

        if (derivedType === MovementType.INCOME) {
          agg[i].incomeCents += magnitude;
        } else {
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

      // Procesar calculados de cuota (Fase 1.1.7.ext)
      // El rango on-the-fly del grupo limita los meses de aparición.
      for (const calc of calculadosDeCuotaAnual) {
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const groupData = calc.sourceInstallmentGroupId
          ? groupAnualMap.get(calc.sourceInstallmentGroupId)
          : undefined;
        if (!groupData) continue;

        // Verificar límite on-the-fly del grupo
        const endMonth = addMonths(groupData.startMonth, groupData.totalInstallments);
        if (mes >= endMonth) continue;

        const derivedAmount = applyFormula(
          groupData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        // Calculados heredan moneda/cotización/anchor del origen; re-rutear vía pivot rates
        const magnitude = convertToDisplayCurrency(
          Math.abs(derivedAmount),
          groupData.currency,
          groupData.exchangeRate,
          groupData.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        // Acumular en el universo estable (sin filtro) para EXPENSE
        if (derivedType === MovementType.EXPENSE) {
          if (!catMetaAll.has(calc.categoryId)) {
            catMetaAll.set(calc.categoryId, {
              categoryId: calc.categoryId,
              name: calc.categoryName,
              color: calc.categoryColor,
            });
          }
          annualExpenseAll.set(
            calc.categoryId,
            (annualExpenseAll.get(calc.categoryId) ?? 0) + magnitude,
          );
        }

        if (filterSet !== null && !filterSet.has(calc.categoryId)) continue;

        if (derivedType === MovementType.INCOME) {
          agg[i].incomeCents += magnitude;
        } else {
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
      const endMonth = addMonths(grupo.startMonth, grupo.totalInstallments);

      for (let i = 0; i < 12; i++) {
        const mes = months12[i];
        if (grupo.startMonth > mes || mes >= endMonth) continue;

        // Fase 1.2.4: re-rutear vía pivot rates del mes correspondiente a cada cuota
        const pivotRates = pivotRatesForYear.get(mes) ?? null;
        const convertedAmount = convertToDisplayCurrency(
          grupo.amountCents,
          grupo.currency,
          grupo.exchangeRate,
          grupo.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        // Acumular en el universo estable (sin filtro) para EXPENSE
        if (grupo.type === 'EXPENSE') {
          if (!catMetaAll.has(grupo.categoryId)) {
            catMetaAll.set(grupo.categoryId, {
              categoryId: grupo.categoryId,
              name: grupo.categoryName,
              color: grupo.categoryColor,
            });
          }
          annualExpenseAll.set(
            grupo.categoryId,
            (annualExpenseAll.get(grupo.categoryId) ?? 0) + convertedAmount,
          );
        }

        if (filterSet !== null && !filterSet.has(grupo.categoryId)) continue;

        if (grupo.type === 'INCOME') {
          agg[i].incomeCents += convertedAmount;
        } else {
          agg[i].expenseCents += convertedAmount;
          const prev = agg[i].categoryExpense.get(grupo.categoryId) ?? 0;
          agg[i].categoryExpense.set(
            grupo.categoryId,
            prev + convertedAmount,
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

    // 7. Universo estable de categorías (sin filtro), ordenado por gasto anual DESC, desempate categoryId ASC
    const availableCategories: AvailableCategory[] = Array.from(catMetaAll.values()).sort((a, b) => {
      const totalA = annualExpenseAll.get(a.categoryId) ?? 0;
      const totalB = annualExpenseAll.get(b.categoryId) ?? 0;
      if (totalB !== totalA) return totalB - totalA;
      return a.categoryId.localeCompare(b.categoryId);
    });

    this.logger.debug(
      {
        userId,
        year,
        filterCount: filterSet?.size ?? null,
        monthsWithData: monthsResult.filter(
          (m) => m.incomeCents > 0 || m.expenseCents > 0,
        ).length,
        categoriesCount: categoriesResult.length,
        availableCategoriesCount: availableCategories.length,
        earliestYear,
      },
      'Serie de reportes de movimientos calculada',
    );

    return {
      year,
      months: monthsResult,
      categories: categoriesResult,
      availableCategories,
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
