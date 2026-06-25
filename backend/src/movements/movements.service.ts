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
  RawDailyUnicoRow,
} from './movements.repository';
import { applyFormula } from '../recurring/formula.helper';
import { convertToDisplayCurrency, convertToDisplayCurrencyByMonth, PivotRates, buildPivotRates, deriveExchangeRate } from '../common/currency.helper';
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

// ---------------------------------------------------------------------------
// Shapes para el reporte anual de únicos (grilla día×mes) — Ola 3 / P2
// ---------------------------------------------------------------------------

/**
 * Footer por mes en el reporte anual de únicos.
 *
 * Todas las métricas monetarias en centavos de displayCurrency.
 *
 * Campos:
 *   total           — total de gastos únicos EXPENSE del mes, en centavos.
 *   dailyAvg        — promedio por día: total ÷ divisor.
 *                     Divisor = día actual si es el mes en curso del año pedido;
 *                     días del mes si ya terminó; 0 si el mes es futuro.
 *                     null cuando no hay datos (total=0 y no hay divisor útil).
 *   pctVsPrev       — %dif vs mes anterior: ROUNDDOWN((avgActual*100/avgPrev)-100, 2).
 *                     null si promedio anterior = 0 o si avgActual es null.
 *   inflationPct    — puntos % de inflación mensual (InflationRate.monthlyVariation).
 *                     null si no hay dato para el mes.
 *   pctVsPrevAdj    — mismo que pctVsPrev pero inflando el promedio anterior por inflationPct.
 *                     null si falta inflationPct o si avgPrev=0 o avgActual=null.
 */
export interface AnnualUnicosMonthFooter {
  total: number;
  dailyAvg: number | null;
  pctVsPrev: number | null;
  inflationPct: number | null;
  pctVsPrevAdj: number | null;
}

/**
 * Entrada del desglose por categoría de una celda del grid.
 * amount está en centavos de displayCurrency (misma conversión que grid[d][m]).
 * Ordenado por amount DESC para que el front no reordene.
 */
export interface CellCategoryBreakdown {
  categoryId: string;
  amount: number;
}

/**
 * Shape completo de la respuesta de GET /movements/reports/annual-unicos.
 *
 * grid: matriz [día 1..31][mes 1..12] de totales diarios en centavos.
 *       grid[d][m] = total de gastos únicos EXPENSE del día d+1 del mes m+1
 *       (índices base-0). Días inválidos para el mes (ej: día 29 en febrero
 *       sin año bisiesto) tienen el valor 0.
 *       Unidades: centavos enteros de displayCurrency.
 *
 * breakdown: matriz paralela a grid, mismos índices [d][m].
 *       breakdown[d][m] = array de { categoryId, amount } ordenado por amount DESC,
 *       con el desglose por categoría de esa celda en centavos de displayCurrency.
 *       Respeta el mismo filtro de categorías que grid.
 *       Celdas sin gasto o días inexistentes del mes → array vacío ([]).
 *       El front no necesita name/color porque ya tiene el universo de categorías.
 *
 * footer: array de 12 entradas (índice = mes − 1) con las métricas del footer.
 *
 * availableCategories: universo de categorías del año (sin filtro) ordenado
 *   por gasto anual DESC, para poblar el selector de filtro del frontend.
 *
 * currency: la moneda de display usada en este resultado (para que el front
 *   formatee correctamente sin volver a pedirla).
 *
 * year: el año pedido.
 *
 * colorAnchorCents: ancla de escala de color de la grilla.
 *   Equivale a 15 USD (1500 centavos de USD) convertidos a `currency`
 *   usando el TC del primer mes disponible del año pedido en ReferenceRate
 *   (con clamp al mes más cercano si el año no tiene datos).
 *   Cuando currency == USD, siempre es 1500 (sin conversión).
 *   El front usa este valor para anclar su paleta de colores de celdas.
 */
export interface AnnualUnicosResponse {
  year: number;
  currency: Currency;
  grid: number[][];
  breakdown: CellCategoryBreakdown[][][];
  footer: AnnualUnicosMonthFooter[];
  availableCategories: AvailableCategory[];
  colorAnchorCents: number;
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

        // P3: fijos usan TC oficial del mes (pivotRates), no el exchangeRate guardado.
        const convertedAmount = convertToDisplayCurrencyByMonth(
          fijo.amountCents,
          fijo.currency,
          displayCurrency,
          pivotRates,
          fijo.exchangeRate,
          fijo.anchorCurrency,
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
        // Skip heredado del origen OR skip propio del calculado en este mes (RF-MF-005)
        if (originData.skipped || calc.skippedMonths.has(mes)) continue;

        const derivedAmount = applyFormula(
          originData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        // P3: calculados de fijo usan TC oficial del mes (pivotRates), no el exchangeRate del origen.
        const magnitude = convertToDisplayCurrencyByMonth(
          Math.abs(derivedAmount),
          originData.currency,
          displayCurrency,
          pivotRates,
          originData.exchangeRate,
          originData.anchorCurrency,
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

        // P3: calculados de cuota usan TC oficial del mes (pivotRates), no el exchangeRate del grupo.
        const magnitude = convertToDisplayCurrencyByMonth(
          Math.abs(derivedAmount),
          groupData.currency,
          displayCurrency,
          pivotRates,
          groupData.exchangeRate,
          groupData.anchorCurrency,
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

        // P3: cuotas usan TC oficial del mes de la instancia (pivotRates), no el exchangeRate guardado.
        const pivotRates = pivotRatesForYear.get(mes) ?? null;
        const convertedAmount = convertToDisplayCurrencyByMonth(
          grupo.amountCents,
          grupo.currency,
          displayCurrency,
          pivotRates,
          grupo.exchangeRate,
          grupo.anchorCurrency,
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
  // Reporte anual de únicos — grilla día×mes (Ola 3 / P2)
  // ---------------------------------------------------------------------------

  /**
   * Devuelve la grilla día×mes de gastos únicos EXPENSE del año, con footer por mes.
   *
   * Parámetros:
   *   userId         — scopea todos los datos.
   *   year           — año pedido (4 dígitos).
   *   categoryIds    — null = todas; [] = ninguna (todo en 0); [...] = subconjunto.
   *   currencyOverride — override de display; null/undefined = default del usuario.
   *   today          — fecha actual para el cálculo del divisor del mes en curso
   *                    (YYYY-MM-DD). Si no viene, se usa la fecha UTC del sistema.
   *
   * Reglas de footer:
   *   (a) total: suma de gastos únicos EXPENSE del mes (en centavos de displayCurrency).
   *   (b) dailyAvg: total ÷ divisor.
   *       - mes futuro (mes > hoy): divisor = 0 → dailyAvg = null.
   *       - mes en curso del año actual: divisor = día actual.
   *       - mes pasado: divisor = días del mes.
   *       (Si el año pedido < año actual, todos los meses son "pasados".)
   *   (c) pctVsPrev = ROUNDDOWN((avgActual * 100 / avgAnterior) - 100, 2).
   *       - avgAnterior = dailyAvg del mes anterior; para enero = dailyAvg de dic año previo.
   *       - si avgAnterior = 0 o avgActual = null → null.
   *   (d) inflationPct: monthlyVariation del mes (InflationRate). null si no hay dato.
   *   (e) pctVsPrevAdj: igual que (c) pero avgAnterior se multiplica por (1 + inflationPct/100).
   *       - null si falta inflationPct, o si avgAnterior = 0, o si avgActual = null.
   */
  async getAnnualUnicosReport(
    userId: string,
    year: number,
    categoryIds?: string[] | null,
    currencyOverride?: Currency | null,
    today?: string,
  ): Promise<AnnualUnicosResponse> {
    // Normalizar filtro de categorías (misma semántica que getReportsMovements)
    const filterSet: Set<string> | null =
      categoryIds === null || categoryIds === undefined
        ? null
        : categoryIds.length === 0
          ? new Set<string>()
          : new Set(categoryIds);

    // Determinar fecha "hoy" para el divisor del mes en curso
    const todayDate = today ? new Date(today + 'T00:00:00Z') : new Date();
    const todayYear = todayDate.getUTCFullYear();
    const todayMonth = todayDate.getUTCMonth() + 1; // 1-based
    const todayDay = todayDate.getUTCDate();

    // Cargar moneda de display y pivot rates del año en paralelo
    const [userSettings, pivotRatesForYear, inflationRates] = await Promise.all([
      this.settingsService.getSettings(userId),
      this.repo.loadPivotRatesForYear(year),
      this.repo.loadInflationRatesForYear(year),
    ]);
    const displayCurrency: Currency =
      currencyOverride != null ? currencyOverride : userSettings.defaultCurrency;

    const yearStr = String(year).padStart(4, '0');

    // Cargar datos de únicos del año y de diciembre del año previo (para el footer de enero)
    const [unicosYear, unicosPrevDec] = await Promise.all([
      this.repo.getDailyUnicosExpenseForYear(userId, year),
      this.repo.getDailyUnicosExpenseForPrevDecember(userId, year),
    ]);

    // ---------------------------------------------------------------------------
    // Función auxiliar: convertir una fila diaria a centavos de displayCurrency
    // ---------------------------------------------------------------------------
    const convertRow = (row: RawDailyUnicoRow, monthKey: string): number => {
      const pivotRates = pivotRatesForYear.get(monthKey) ?? null;
      return convertToDisplayCurrency(
        Number(row.totalCents),
        row.currency as Currency,
        Number(row.exchangeRate),
        row.anchorCurrency as Currency,
        displayCurrency,
        pivotRates,
      );
    };

    // ---------------------------------------------------------------------------
    // Construir el universo de categorías disponibles (sin filtro, para el selector)
    // ---------------------------------------------------------------------------
    const catMetaAll = new Map<string, AnnualCategoryMeta>();
    const annualExpenseAll = new Map<string, number>();

    // ---------------------------------------------------------------------------
    // Inicializar la grilla: [día 0..30][mes 0..11] → centavos (0 initial)
    // grid[dayIndex][monthIndex] donde dayIndex = day − 1
    // ---------------------------------------------------------------------------
    const grid: number[][] = Array.from({ length: 31 }, () => new Array(12).fill(0));

    // ---------------------------------------------------------------------------
    // Inicializar breakdown paralela a grid.
    // breakdown[dayIndex][monthIndex] = Map<categoryId, amount> (acumulación temporal).
    // Se convierte a array ordenado por amount DESC al final.
    // ---------------------------------------------------------------------------
    const breakdownMaps: Array<Array<Map<string, number>>> =
      Array.from({ length: 31 }, () =>
        Array.from({ length: 12 }, () => new Map<string, number>()),
      );

    // Mapa auxiliar: monthKey → total de gastos del mes (con filtro de categorías)
    const monthTotals: number[] = new Array(12).fill(0);

    // ---------------------------------------------------------------------------
    // Procesar únicos del año pedido
    // ---------------------------------------------------------------------------
    for (const row of unicosYear) {
      const monthNum = parseInt(row.monthKey.split('-')[1], 10);
      const monthIdx = monthNum - 1; // 0-based
      if (monthIdx < 0 || monthIdx > 11) continue;
      if (row.day < 1 || row.day > 31) continue;
      const dayIdx = row.day - 1;

      const cents = convertRow(row, row.monthKey);

      // Acumular al universo estable (sin filtro)
      if (!catMetaAll.has(row.categoryId)) {
        // Solo tenemos categoryId aquí; la metadata de nombre/color requiere un JOIN.
        // Para no hacer un JOIN en la query de la grilla (que agrega), se carga de forma
        // diferida. Guardamos un marker y lo resolveremos al final si necesitamos nombre.
        // Por ahora solo el gasto anual:
        catMetaAll.set(row.categoryId, { categoryId: row.categoryId, name: '', color: '' });
      }
      annualExpenseAll.set(
        row.categoryId,
        (annualExpenseAll.get(row.categoryId) ?? 0) + cents,
      );

      // Aplicar filtro de categorías
      if (filterSet !== null && !filterSet.has(row.categoryId)) continue;

      grid[dayIdx][monthIdx] += cents;
      monthTotals[monthIdx] += cents;

      // Acumular en breakdown (misma conversión y mismo filtro que grid)
      const cellMap = breakdownMaps[dayIdx][monthIdx];
      cellMap.set(row.categoryId, (cellMap.get(row.categoryId) ?? 0) + cents);
    }

    // ---------------------------------------------------------------------------
    // Acumular el total de diciembre del año previo (para el footer de enero)
    // Usamos el mismo filterSet.
    // ---------------------------------------------------------------------------
    let prevDecTotal = 0;
    let prevDecDays = 31; // diciembre siempre tiene 31 días
    for (const row of unicosPrevDec) {
      if (filterSet !== null && !filterSet.has(row.categoryId)) continue;
      const monthKey = row.monthKey; // YYYY-12
      const pivotRatesPrevDec = pivotRatesForYear.get(monthKey) ?? null;
      const cents = convertToDisplayCurrency(
        Number(row.totalCents),
        row.currency as Currency,
        Number(row.exchangeRate),
        row.anchorCurrency as Currency,
        displayCurrency,
        pivotRatesPrevDec,
      );
      prevDecTotal += cents;
    }
    // Pivot rates para diciembre del año previo: usar el más cercano disponible
    // (ya lo resuelve loadPivotRatesForYear del año actual — usamos clave '${year}-01'
    // como proxy al más antiguo disponible del año; para conversión de prevDec usamos
    // la misma pivotRatesForYear que ya clampa al mínimo disponible si falta).

    // ---------------------------------------------------------------------------
    // Enriquecer catMetaAll con nombre/color: necesitamos cargar las categorías.
    // Estrategia: leer categoryIds de catMetaAll y hacer findMany en una sola query.
    // ---------------------------------------------------------------------------
    if (catMetaAll.size > 0) {
      const catIds = Array.from(catMetaAll.keys());
      const catRows = await this.repo.findCategoriesByIds(catIds);
      for (const cat of catRows) {
        catMetaAll.set(cat.id, { categoryId: cat.id, name: cat.name, color: cat.color });
      }
    }

    // ---------------------------------------------------------------------------
    // Construir footer (12 entradas)
    // ---------------------------------------------------------------------------
    const footer: AnnualUnicosMonthFooter[] = [];

    // dailyAvg del mes anterior para el cálculo de pctVsPrev
    // Para enero (mes 1): mes anterior = diciembre del año previo
    let prevMonthDailyAvg: number | null = null;

    // Pre-calcular dailyAvg de diciembre del año previo
    const prevDecAvg = prevDecTotal > 0 ? prevDecTotal / prevDecDays : 0;

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const monthNum = monthIdx + 1;
      const monthKey = `${yearStr}-${String(monthNum).padStart(2, '0')}`;
      const total = monthTotals[monthIdx];

      // --- (b) dailyAvg: calcular divisor ---
      let divisor: number;
      const daysInMonth = getDaysInMonth(year, monthNum);

      if (year < todayYear) {
        // Año pasado: todos los meses son pasados
        divisor = daysInMonth;
      } else if (year > todayYear) {
        // Año futuro: todos los meses son futuros
        divisor = 0;
      } else {
        // Año actual
        if (monthNum < todayMonth) {
          // Mes ya terminado
          divisor = daysInMonth;
        } else if (monthNum === todayMonth) {
          // Mes en curso
          divisor = todayDay;
        } else {
          // Mes futuro
          divisor = 0;
        }
      }

      const dailyAvg: number | null = divisor > 0 ? total / divisor : null;

      // --- (c) pctVsPrev ---
      // Para enero (monthIdx=0): prevMonthDailyAvg = prevDecAvg
      const avgPrev: number = monthIdx === 0 ? prevDecAvg : (prevMonthDailyAvg ?? 0);
      const pctVsPrev: number | null =
        dailyAvg !== null && avgPrev > 0
          ? roundDown((dailyAvg * 100) / avgPrev - 100, 2)
          : null;

      // --- (d) inflationPct ---
      const inflationPct: number | null = inflationRates.get(monthKey) ?? null;

      // --- (e) pctVsPrevAdj ---
      let pctVsPrevAdj: number | null = null;
      if (dailyAvg !== null && avgPrev > 0 && inflationPct !== null) {
        const avgPrevInflated = avgPrev * (1 + inflationPct / 100);
        pctVsPrevAdj = avgPrevInflated > 0
          ? roundDown((dailyAvg * 100) / avgPrevInflated - 100, 2)
          : null;
      }

      footer.push({ total, dailyAvg, pctVsPrev, inflationPct, pctVsPrevAdj });

      // Actualizar prevMonthDailyAvg para el siguiente mes
      prevMonthDailyAvg = dailyAvg;
    }

    // ---------------------------------------------------------------------------
    // Convertir breakdownMaps a la matriz final con arrays ordenados por amount DESC
    // ---------------------------------------------------------------------------
    const breakdown: CellCategoryBreakdown[][][] = breakdownMaps.map((dayRow) =>
      dayRow.map((cellMap) => {
        if (cellMap.size === 0) return [];
        return Array.from(cellMap.entries())
          .map(([categoryId, amount]) => ({ categoryId, amount }))
          .sort((a, b) => b.amount - a.amount);
      }),
    );

    // ---------------------------------------------------------------------------
    // Construir availableCategories ordenado por gasto anual DESC, desempate ASC
    // ---------------------------------------------------------------------------
    const availableCategories: AvailableCategory[] = Array.from(catMetaAll.values())
      .sort((a, b) => {
        const totalA = annualExpenseAll.get(a.categoryId) ?? 0;
        const totalB = annualExpenseAll.get(b.categoryId) ?? 0;
        if (totalB !== totalA) return totalB - totalA;
        return a.categoryId.localeCompare(b.categoryId);
      });

    // ---------------------------------------------------------------------------
    // colorAnchorCents — ancla de escala de color para el frontend
    //
    // Equivalente a 15 USD (1500 centavos) en la moneda de display, usando el TC
    // del primer mes del año pedido disponible en ReferenceRate (con clamp).
    // Criterio: enero del año (`${year}-01`) resuelto vía pivotRatesForYear,
    // que ya clampea al mes más cercano si enero no tiene datos en la tabla.
    //
    // Cuando displayCurrency == USD → 1500 directos (sin conversión).
    // Para otras monedas → deriveExchangeRate(USD, displayCurrency, pivotRates)
    // aplicado sobre 1500 centavos de USD, redondeado a centavos enteros.
    // ---------------------------------------------------------------------------
    const COLOR_ANCHOR_USD_CENTS = 1500; // 15 USD en centavos
    let colorAnchorCents: number;

    if (displayCurrency === Currency.USD) {
      colorAnchorCents = COLOR_ANCHOR_USD_CENTS;
    } else {
      // Usar el TC de enero del año pedido (ya clampeado por loadPivotRatesForYear)
      const januaryKey = `${yearStr}-01`;
      const pivotRatesJanuary = pivotRatesForYear.get(januaryKey) ?? null;
      const rate = deriveExchangeRate(Currency.USD, displayCurrency, pivotRatesJanuary);
      // Si no hay datos de referencia (tabla vacía), usar 1500 como fallback defensivo.
      colorAnchorCents = rate !== null ? Math.round(COLOR_ANCHOR_USD_CENTS * rate) : COLOR_ANCHOR_USD_CENTS;
    }

    this.logger.debug(
      {
        userId,
        year,
        displayCurrency,
        filterCount: filterSet?.size ?? null,
        availableCategoriesCount: availableCategories.length,
        colorAnchorCents,
      },
      'Reporte anual de únicos calculado',
    );

    return {
      year,
      currency: displayCurrency,
      grid,
      breakdown,
      footer,
      availableCategories,
      colorAnchorCents,
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

// ---------------------------------------------------------------------------
// Helpers de módulo (no exportados)
// ---------------------------------------------------------------------------

/**
 * Devuelve la cantidad de días en un mes dado.
 * Tiene en cuenta años bisiestos para febrero.
 */
export function getDaysInMonth(year: number, month: number): number {
  // El día 0 del mes siguiente = último día del mes dado
  return new Date(year, month, 0).getDate();
}

/**
 * Aplica ROUNDDOWN con N decimales (equivale a truncar hacia cero con N decimales).
 * Equivalente al ROUNDDOWN de Excel: redondea hacia el cero (trunca).
 *
 * Para valores negativos: ROUNDDOWN(-2.9, 0) = -2 (no -3).
 * Math.trunc(x * 10^n) / 10^n implementa esto correctamente.
 */
export function roundDown(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.trunc(value * factor) / factor;
}
