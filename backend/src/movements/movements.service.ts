import { BadRequestException, Injectable } from '@nestjs/common';
import { Currency, FormulaOperator, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsRepository,
  MovementItem,
  AnnualCategoryMeta,
  RecurringForAnnual,
  addMonths,
  monthDiff,
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
  /**
   * RF-REP-015: true si este mes es proyectado (futuro respecto de "hoy") y el flag
   * projectFixed está activo. false en todos los demás casos (tramo real o flag off).
   * Siempre presente en la respuesta para que el frontend pueda distinguir el tramo.
   */
  projected: boolean;
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
 *   Equivale a `anchorUsdCents` (default 15 USD = 1500 centavos de USD, o el
 *   valor pedido vía anchorAmountCents/anchorCurrency) convertidos a `currency`
 *   usando el TC del primer mes disponible del año pedido en ReferenceRate
 *   (con clamp al mes más cercano si el año no tiene datos).
 *   Cuando currency == USD, siempre es igual a anchorUsdCents (sin conversión).
 *   El front usa este valor para anclar su paleta de colores de celdas.
 *
 * anchorUsdCents: ancla canónica en centavos de USD efectivamente usada para
 *   derivar colorAnchorCents (P3). Es 1500 (default) si el caller no mandó
 *   anchorAmountCents/anchorCurrency, o el resultado de convertir ese par a
 *   USD si sí los mandó. El front la persiste para prellenar el editor.
 */
export interface AnnualUnicosResponse {
  year: number;
  currency: Currency;
  grid: number[][];
  breakdown: CellCategoryBreakdown[][][];
  footer: AnnualUnicosMonthFooter[];
  availableCategories: AvailableCategory[];
  colorAnchorCents: number;
  anchorUsdCents: number;
}

// ---------------------------------------------------------------------------
// Shapes para el reporte anual de cuotas (gantt) — Ola 3 / P2
// ---------------------------------------------------------------------------

/**
 * Una barra del gantt de cuotas.
 *
 * Campos:
 *   id                — id del InstallmentGroup.
 *   description       — descripción del grupo; null si no tiene.
 *   categoryId        — id de la categoría (el front resuelve nombre/color desde availableCategories).
 *   amountCents       — monto POR CUOTA convertido a displayCurrency.
 *                       TC usado: el del primer mes visible de la barra en el año:
 *                         - si startMonth está dentro del año → TC del startMonth
 *                         - si startMonth está antes del año  → TC de enero del año (YYYY-01)
 *                       Coherente con P3 (cuotas usan TC oficial del mes de la instancia).
 *   startMonthIndex   — índice 0-based del primer mes visible en el año (0=ene, 11=dic),
 *                       recortado al año pedido. Si la cuota empieza antes de enero → 0.
 *   endMonthIndex     — índice 0-based del último mes visible (inclusivo), recortado al año.
 *                       Si la cuota termina después de diciembre → 11.
 *   continuesBefore   — true si la cuota empieza ANTES de enero del año pedido.
 *   continuesAfter    — true si la cuota termina DESPUÉS de diciembre del año pedido.
 *   installmentFrom   — número de cuota que cae en startMonthIndex (1-based).
 *   installmentTo     — número de cuota que cae en endMonthIndex (1-based).
 *   totalInstallments — total de cuotas del grupo.
 *   rowIndex          — renglón asignado por el packing (0 = más cercano al eje, crece hacia arriba).
 *   realStartMonth    — "YYYY-MM" del mes de la primera cuota (= startMonth del InstallmentGroup).
 *                       NO recortado al año pedido; puede ser de un año anterior.
 *   realEndMonth      — "YYYY-MM" del mes de la última cuota (= startMonth + totalInstallments - 1 meses).
 *                       NO recortado al año pedido; puede ser de un año posterior.
 */
export interface GanttBar {
  id: string;
  description: string | null;
  categoryId: string;
  amountCents: number;
  startMonthIndex: number;
  endMonthIndex: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  installmentFrom: number;
  installmentTo: number;
  totalInstallments: number;
  rowIndex: number;
  realStartMonth: string;
  realEndMonth: string;
}

/**
 * Shape completo de la respuesta de GET /movements/reports/annual-cuotas.
 *
 * bars: barras del gantt, ya empacadas (packing calculado sobre el subconjunto filtrado).
 *       Ordenadas por rowIndex ASC y dentro de cada renglón por startMonthIndex ASC.
 *
 * rowCount: total de renglones usados por el packing (max rowIndex + 1; 0 si bars vacío).
 *
 * availableCategories: universo de categorías con cuotas EXPENSE en el año, SIN aplicar
 *   el filtro de categorías. El front resuelve nombre/color de cada barra desde aquí.
 *   Ordenado por amountCents DESC (suma de meses visibles en el año), desempate ASC por categoryId.
 *
 * currency: moneda de display usada (para que el front formatee sin re-pedirla).
 * year: el año pedido.
 */
export interface AnnualCuotasResponse {
  year: number;
  currency: Currency;
  bars: GanttBar[];
  rowCount: number;
  availableCategories: AvailableCategory[];
}

// ---------------------------------------------------------------------------
// Shapes para el reporte anual de inflación vs ingresos — P5
// ---------------------------------------------------------------------------

/**
 * Punto del mes en el reporte anual de inflación vs ingresos.
 *
 * inflationPct  — variación IPC del mes en puntos %; null si no hay dato.
 * incomePct     — variación MoM del ingreso total del mes (truncada 2 dec).
 *                 null si el mes es futuro (del año en curso) o si ingreso anterior es 0.
 * incomePctAdj  — igual que incomePct pero el ingreso anterior se infla por IPC del mes.
 *                 null si falta IPC, si el mes es futuro, o si el ingreso anterior es 0.
 */
export interface AnnualInflationIncomeMonth {
  inflationPct: number | null;
  incomePct: number | null;
  incomePctAdj: number | null;
}

/**
 * Línea de tendencia lineal por mínimos cuadrados.
 * Se exponen los 12 puntos de la recta (índice = mes-1), uno por mes,
 * calculados como y = slope * x + intercept donde x = índice de mes (0..11).
 * Los meses sin punto de datos contribuyen al cálculo con la recta; los que
 * caen fuera del rango de puntos disponibles también llevan el valor de la recta.
 * null si hay menos de 2 puntos no nulos (recta no computable).
 */
export interface AnnualInflationIncomeTrend {
  slope: number;
  intercept: number;
  /** 12 valores de la recta en los índices de mes 0..11. null si no computable. */
  points: number[] | null;
}

/**
 * Shape completo de la respuesta de GET /movements/reports/annual-inflation-income.
 */
export interface AnnualInflationIncomeResponse {
  year: number;
  currency: Currency;
  months: AnnualInflationIncomeMonth[]; // siempre 12, índice = mes-1
  incomeTrend: AnnualInflationIncomeTrend;
  incomeAdjTrend: AnnualInflationIncomeTrend;
  earliestYear: number | null;
  availableCategories: AvailableCategory[];
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
      .filter((u) => !u.skipped && u.type === 'EXPENSE')
      .reduce((sum, u) => sum + u.convertedAmountCents, 0);
    const unicosIncome = unicosFiltrados
      .filter((u) => !u.skipped && u.type === 'INCOME')
      .reduce((sum, u) => sum + u.convertedAmountCents, 0);

    const fijosExpense = fijosFiltrados
      .filter((f) => !f.skipped && f.type === 'EXPENSE')
      .reduce((sum, f) => sum + f.convertedAmountCents, 0);
    const fijosIncome = fijosFiltrados
      .filter((f) => !f.skipped && f.type === 'INCOME')
      .reduce((sum, f) => sum + f.convertedAmountCents, 0);

    const cuotasExpense = cuotasFiltradas
      .filter((c) => !c.skipped && c.type === 'EXPENSE')
      .reduce((sum, c) => sum + c.convertedAmountCents, 0);
    const cuotasIncome = cuotasFiltradas
      .filter((c) => !c.skipped && c.type === 'INCOME')
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
    typesFilter?: string[] | null,
    direction?: 'both' | 'expense' | 'income',
    projectFixed?: boolean,
    today?: string,
  ): Promise<ReportsMovementsResponse> {
    // Normalizar el filtro de categorías
    const EMPTY_SET = new Set<string>();
    const filterSet: Set<string> | null =
      categoryIds === null || categoryIds === undefined
        ? null
        : categoryIds.length === 0
          ? EMPTY_SET
          : new Set(categoryIds);

    // RF-REP-014: filtro por tipo de movimiento (3-state semántica, igual que categorías)
    // null = todos los tipos; Set vacío = ninguno; Set con valores = subconjunto.
    const typeSet: Set<string> | null =
      typesFilter === null || typesFilter === undefined
        ? null
        : new Set(typesFilter);

    const includeMovType = (movType: 'fijo' | 'cuota' | 'unico'): boolean => {
      if (typeSet === null) return true;
      return typeSet.has(movType);
    };

    // RF-REP-014: filtro de dirección. 'both' = sin filtro (default).
    const dir: 'both' | 'expense' | 'income' = direction ?? 'both';

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

    // ---------------------------------------------------------------------------
    // RF-REP-015: Proyección de fijos a futuro
    // ---------------------------------------------------------------------------

    // Fecha "hoy" para distinguir meses pasados/presentes de futuros.
    // Misma convención que getAnnualUnicosReport y getAnnualInflationIncomeReport:
    // el param today viene como YYYY-MM-DD; ausente → fecha UTC del sistema.
    const todayDate = today ? new Date(today + 'T00:00:00Z') : new Date();
    const todayMonthKey = `${String(todayDate.getUTCFullYear()).padStart(4, '0')}-${String(todayDate.getUTCMonth() + 1).padStart(2, '0')}`;

    // lineRate: tasa de precio same-basket (mensual) de la canasta comparable de
    // cada línea (gasto/ingreso). Solo se computa cuando projectFixed=true.
    const lineRate: { expense: number; income: number } = { expense: 0, income: 0 };

    // Referencia a computeFixedLineTotal (canasta_conocida), expuesta fuera del
    // bloque `if (projectFixed === true)` para que el loop principal la use al
    // aplicar la proyección en cada mes futuro. Solo se asigna cuando
    // projectFixed=true (mismas condiciones bajo las que isFutureMonth puede ser true).
    let computeFixedLineTotalForProjection:
      | ((mes: string, lineType: 'EXPENSE' | 'INCOME') => number)
      | null = null;

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
      if (!includeMovType('unico')) continue;

      if (row.type === 'INCOME') {
        if (dir !== 'expense') agg[idx].incomeCents += cents;
      } else {
        if (dir !== 'income') {
          agg[idx].expenseCents += cents;
          const prev = agg[idx].categoryExpense.get(row.categoryId) ?? 0;
          agg[idx].categoryExpense.set(row.categoryId, prev + cents);
        }
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
    const txAnualMap = new Map<string, { amountCents: number; description: string | null; currency: Currency; exchangeRate: number; anchorCurrency: Currency; skipped: boolean }>();
    if (txIdsAnual.length > 0) {
      const txRows = await this.repo.findTransactionsByIds(txIdsAnual);
      for (const tx of txRows) txAnualMap.set(tx.id, {
        amountCents: tx.amountCents,
        description: tx.description,
        currency: tx.currency,
        exchangeRate: tx.exchangeRate,
        anchorCurrency: tx.anchorCurrency,
        skipped: tx.skipped,
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
      skippedMonths: Set<string>;
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
        skippedMonths: g.skippedMonths,
      });
    }

    // ---------------------------------------------------------------------------
    // RF-REP-015: Proyección de fijos a futuro — esqueleto determinista × tasa de
    // precio de canasta comparable (same-basket), POR LÍNEA (gasto/ingreso).
    // Solo se ejecuta cuando projectFixed=true — costeo mínimo cuando está off.
    //
    //   valor_línea(m) = canasta_conocida(m) × (1 + tasa_precio)^m
    //
    // canasta_conocida(m): total de fijos (normales + calculados-de-fijo) EN
    //   ALCANCE (RF-REP-014: dirección, tipos, categorías) activos en el mes
    //   futuro `m`, cada uno a su último monto conocido — mismo criterio de
    //   actividad que un mes real (startMonth/deletedFrom/frecuencia/skip).
    //   Reusa computeFixedLineTotal(mes, lineType), la misma función que ya
    //   calcula el total de un mes arbitrario. Las altas/bajas futuras ya
    //   cargadas (startMonth futuro, deletedFrom futuro) y los fijos anuales se
    //   resuelven acá, NO en la tasa: por eso un fijo nuevo no "explota" la
    //   proyección y la composición futura es determinista.
    //
    // tasa_precio: UNA por línea, crecimiento real ponderado por tamaño,
    //   por cadena (chainId de fijos normales) activa HOY, sobre SU PROPIA
    //   historia disponible en la ventana [hoy-12 .. hoy-1]:
    //     - Para cada cadena activa hoy, se busca su monto más viejo dentro
    //       de la ventana (el mes más antiguo, hasta 12, donde esa MISMA
    //       cadena estaba activa): old_i, a distancia n_i meses de hoy.
    //     - Sin historia previa en la ventana (alta reciente) u old_i = 0 →
    //       la cadena se EXCLUYE del cálculo de la tasa (no infla; su
    //       composición ya la maneja canasta_conocida).
    //     - growth_i = (today_i / old_i)^(1/n_i) − 1 (CAGR mensual propio).
    //     - tasa_precio = promedio ponderado por tamaño (peso = today_i):
    //         Σ(today_i · growth_i) / Σ(today_i), sobre cadenas con historia.
    //   Esto evita que una única cadena "ancla" (la única con 12 meses de
    //   historia) opaque el resto de las cadenas que solo tienen historia
    //   parcial pero varían fuerte.
    //   Piso en 0 (nunca proyecta bajas): Math.max(0, tasa). Sin ninguna
    //   cadena con historia → tasa = 0. NO usa IPC en ningún caso.
    //
    // Los montos se calculan en displayCurrency (mismo criterio que
    // incomeCents/expenseCents), convirtiendo cada mes con SU PROPIO TC oficial;
    // la proyección hacia adelante ya no vuelve a convertir (no hay TC futuro real).
    //
    // Skips: no cuentan para la tasa (se usa el monto conocido del segmento
    // activo, sea o no skippeado ese mes puntual) — sí afectan canasta_conocida
    // (mes skippeado → ese fijo aporta 0 ese mes, vía computeFixedLineTotal).
    // ---------------------------------------------------------------------------
    if (projectFixed === true) {
      // Pivot rates extendidas: cubren el año pedido MÁS los años reales que toca
      // la ventana backward + hoy (pueden caer fuera de `year`, ej. reporte de un
      // año viejo con `today` en el año en curso).
      const todayYearNum = parseInt(todayMonthKey.slice(0, 4), 10);
      const extraYears = [...new Set([todayYearNum, todayYearNum - 1])].filter(
        (y) => y !== year,
      );
      const extraPivotMaps = await Promise.all(
        extraYears.map((y) => this.repo.loadPivotRatesForYear(y)),
      );
      const extendedPivotRates = new Map<string, Partial<PivotRates>>(
        pivotRatesForYear,
      );
      for (const m of extraPivotMaps) {
        for (const [k, v] of m) extendedPivotRates.set(k, v);
      }

      type ChainSegment = {
        amountCents: number;
        skipped: boolean;
        startMonth: string;
        currency: Currency;
        exchangeRate: number;
        anchorCurrency: Currency;
        categoryId: string;
        type: MovementType;
      };

      // Segmento activo por cadena en `mes` (mayor startMonth ≤ mes, cumple
      // frecuencia y sigue vigente). Compartido por canasta_conocida y por la
      // selección de cadenas comunes de la tasa.
      const activeByChainAt = (
        mes: string,
      ): { activeByChain: Map<string, ChainSegment>; pivotRates: Partial<PivotRates> | null } => {
        const pivotRates = extendedPivotRates.get(mes) ?? null;
        const activeByChain = new Map<string, ChainSegment>();
        for (const fijo of normalesForAnnual) {
          const inRange =
            fijo.startMonth <= mes &&
            (fijo.deletedFrom === null || fijo.deletedFrom > mes);
          if (!inRange) continue;
          if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;
          const existing = activeByChain.get(fijo.chainId);
          if (!existing || fijo.startMonth > existing.startMonth) {
            activeByChain.set(fijo.chainId, {
              amountCents: fijo.amountCents,
              skipped: fijo.skippedMonths.has(mes),
              startMonth: fijo.startMonth,
              currency: fijo.currency,
              exchangeRate: fijo.exchangeRate,
              anchorCurrency: fijo.anchorCurrency,
              categoryId: fijo.categoryId,
              type: fijo.type as MovementType,
            });
          }
        }
        return { activeByChain, pivotRates };
      };

      // canasta_conocida: total agregado (displayCurrency, cents) de fijos EN
      // ALCANCE de una línea, en un mes arbitrario `mes` (puede caer fuera del
      // año `year`) — cada cadena a su último monto conocido. Es la función que
      // compone el futuro determinísticamente (altas/bajas/fijo anual incluidos).
      const computeFixedLineTotal = (
        mes: string,
        lineType: 'EXPENSE' | 'INCOME',
      ): number => {
        if (!includeMovType('fijo')) return 0;
        if (lineType === 'EXPENSE' && dir === 'income') return 0;
        if (lineType === 'INCOME' && dir === 'expense') return 0;

        const { activeByChain, pivotRates } = activeByChainAt(mes);

        let total = 0;

        // Fijos normales
        for (const data of activeByChain.values()) {
          if (data.skipped) continue;
          if (data.type !== lineType) continue;
          if (filterSet !== null && !filterSet.has(data.categoryId)) continue;
          total += convertToDisplayCurrencyByMonth(
            data.amountCents,
            data.currency,
            displayCurrency,
            pivotRates,
            data.exchangeRate,
            data.anchorCurrency,
          );
        }

        // Calculados de fijo (heredan moneda/cotización del origen)
        for (const calc of calculadosDeFijoAnual) {
          const inRange =
            calc.startMonth <= mes &&
            (calc.deletedFrom === null || calc.deletedFrom > mes);
          if (!inRange) continue;

          const originData = calc.sourceChainId
            ? activeByChain.get(calc.sourceChainId)
            : undefined;
          if (!originData) continue;
          if (originData.skipped || calc.skippedMonths.has(mes)) continue;

          const derivedAmount = applyFormula(
            originData.amountCents,
            calc.formulaOperator as FormulaOperator,
            calc.formulaOperand!,
            calc.formulaSign!,
          );
          const derivedType =
            derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
          if (derivedType !== lineType) continue;
          if (filterSet !== null && !filterSet.has(calc.categoryId)) continue;

          total += convertToDisplayCurrencyByMonth(
            Math.abs(derivedAmount),
            originData.currency,
            displayCurrency,
            pivotRates,
            originData.exchangeRate,
            originData.anchorCurrency,
          );
        }

        return total;
      };

      // Montos activos por cadena (solo fijos normales) EN ALCANCE de una línea,
      // en `mes`, para la comparación same-basket de la tasa. A diferencia de la
      // canasta, IGNORA el skip del mes puntual: el monto conocido de la cadena
      // sigue siendo una señal de precio válida aunque ese mes puntual no se
      // haya cobrado (el skip no cuenta para la tasa).
      const activeChainAmountsForLine = (
        mes: string,
        lineType: 'EXPENSE' | 'INCOME',
      ): Map<string, number> => {
        const result = new Map<string, number>();
        if (!includeMovType('fijo')) return result;
        if (lineType === 'EXPENSE' && dir === 'income') return result;
        if (lineType === 'INCOME' && dir === 'expense') return result;

        const { activeByChain, pivotRates } = activeByChainAt(mes);
        for (const [chainId, data] of activeByChain) {
          if (data.type !== lineType) continue;
          if (filterSet !== null && !filterSet.has(data.categoryId)) continue;
          result.set(
            chainId,
            convertToDisplayCurrencyByMonth(
              data.amountCents,
              data.currency,
              displayCurrency,
              pivotRates,
              data.exchangeRate,
              data.anchorCurrency,
            ),
          );
        }
        return result;
      };

      // 12 meses backward (hoy excluido), en orden cronológico ascendente
      // (i=-12 → today-12, i=-1 → today-1). El más antiguo es el primero.
      const windowMonths: string[] = [];
      for (let i = -12; i <= -1; i++) {
        windowMonths.push(addMonths(todayMonthKey, i));
      }

      for (const [lineKey, lineType] of [
        ['expense', 'EXPENSE'],
        ['income', 'INCOME'],
      ] as const) {
        const todayChains = activeChainAmountsForLine(todayMonthKey, lineType);

        // Montos por cadena en cada mes de la ventana, precomputados una vez
        // (orden ascendente = más antiguo primero) para la búsqueda por cadena.
        const windowChainAmounts = windowMonths.map((wm) =>
          activeChainAmountsForLine(wm, lineType),
        );

        let rate = 0;
        if (todayChains.size > 0) {
          let weightedSum = 0;
          let weightTotal = 0;

          for (const [chainId, todayAmount] of todayChains) {
            // Monto más viejo de ESTA cadena dentro de la ventana (primer
            // match en orden ascendente = mes más antiguo disponible).
            let oldAmount: number | null = null;
            let oldMonth: string | null = null;
            for (let idx = 0; idx < windowMonths.length; idx++) {
              const amt = windowChainAmounts[idx].get(chainId);
              if (amt !== undefined) {
                oldAmount = amt;
                oldMonth = windowMonths[idx];
                break;
              }
            }
            if (oldAmount === null || oldMonth === null) continue; // alta reciente, sin historia
            if (oldAmount <= 0) continue; // evitar div/0

            const n = monthDiff(oldMonth, todayMonthKey);
            if (n < 1) continue;

            const growth = Math.pow(todayAmount / oldAmount, 1 / n) - 1;
            weightedSum += todayAmount * growth;
            weightTotal += todayAmount;
          }

          if (weightTotal > 0) {
            rate = Math.max(0, weightedSum / weightTotal);
          }
        }

        lineRate[lineKey] = rate;
      }

      computeFixedLineTotalForProjection = computeFixedLineTotal;
    }

    for (let i = 0; i < 12; i++) {
      const mes = months12[i];
      // Pivot rates del mes (para re-rutear la conversión si anchorCurrency ≠ displayCurrency)
      const pivotRates = pivotRatesForYear.get(mes) ?? null;

      // RF-REP-015: true cuando estamos en modo proyección Y el mes es futuro.
      const isFutureMonth = projectFixed === true && mes > todayMonthKey;

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

      // Procesar fijos normales.
      // RF-REP-015: el tramo futuro NO suma fijos individuales — se resuelve más
      // abajo con el agregado proyectado de la línea (lineBase/lineRate). Cada fijo
      // solo aporta a agg[i] en su tramo real.
      for (const fijo of normalesForAnnual) {
        if (isFutureMonth) break;

        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;
        if (fijo.skippedMonths.has(mes)) continue;

        const effectiveAmountCents = fijo.amountCents;

        // P3: fijos usan TC oficial del mes (pivotRates), no el exchangeRate guardado.
        const convertedAmount = convertToDisplayCurrencyByMonth(
          effectiveAmountCents,
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
        if (!includeMovType('fijo')) continue;

        if (fijo.type === 'INCOME') {
          if (dir !== 'expense') agg[i].incomeCents += convertedAmount;
        } else {
          if (dir !== 'income') {
            agg[i].expenseCents += convertedAmount;
            const prev = agg[i].categoryExpense.get(fijo.categoryId) ?? 0;
            agg[i].categoryExpense.set(fijo.categoryId, prev + convertedAmount);
          }
        }

        if (!catMeta.has(fijo.categoryId) && fijo.type === 'EXPENSE') {
          catMeta.set(fijo.categoryId, {
            categoryId: fijo.categoryId,
            name: fijo.categoryName,
            color: fijo.categoryColor,
          });
        }
      }

      // RF-REP-015: en meses futuros, la línea vale SOLO el esqueleto determinista
      // (canasta_conocida(m) — computeFixedLineTotalForProjection, fijos en alcance
      // activos ese mes a su último monto conocido) multiplicado por la tasa de
      // precio same-basket de la línea (lineRate, calculada más arriba). Compuesto:
      // canasta*(1+rate)^n, sin truncar intermedios, redondeo solo al final. La
      // contribución de cuotas/únicos/calculados-de-único/calculados-de-cuota al
      // futuro es 0 (se excluyen explícitamente en sus propios loops).
      if (isFutureMonth && computeFixedLineTotalForProjection) {
        const n = monthDiff(todayMonthKey, mes);
        const canastaExpense = computeFixedLineTotalForProjection(mes, 'EXPENSE');
        if (canastaExpense > 0) {
          agg[i].expenseCents += Math.round(
            canastaExpense * Math.pow(1 + lineRate.expense, n),
          );
        }
        const canastaIncome = computeFixedLineTotalForProjection(mes, 'INCOME');
        if (canastaIncome > 0) {
          agg[i].incomeCents += Math.round(
            canastaIncome * Math.pow(1 + lineRate.income, n),
          );
        }
      }

      // Procesar calculados de fijo (Fase 1.1.7)
      for (const calc of calculadosDeFijoAnual) {
        // RF-REP-015: calculados no entran en el tramo proyectado
        if (isFutureMonth) continue;

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
        if (!includeMovType('fijo')) continue;

        if (derivedType === MovementType.INCOME) {
          if (dir !== 'expense') agg[i].incomeCents += magnitude;
        } else {
          if (dir !== 'income') {
            agg[i].expenseCents += magnitude;
            const prev = agg[i].categoryExpense.get(calc.categoryId) ?? 0;
            agg[i].categoryExpense.set(calc.categoryId, prev + magnitude);
          }
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
      // en el mes del único.
      // P3 (Fase 1.1.1.ext): skip heredado del único de origen OR skip propio del calculado.
      for (const calc of calculadosDeUnicoAnual) {
        // RF-REP-015: calculados de único no entran en el tramo proyectado
        if (isFutureMonth) continue;

        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const txData = calc.sourceMovementId ? txAnualMap.get(calc.sourceMovementId) : undefined;
        if (!txData) continue;
        if (txData.skipped || calc.skippedMonths.has(mes)) continue;

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
        if (!includeMovType('unico')) continue;

        if (derivedType === MovementType.INCOME) {
          if (dir !== 'expense') agg[i].incomeCents += magnitude;
        } else {
          if (dir !== 'income') {
            agg[i].expenseCents += magnitude;
            const prev = agg[i].categoryExpense.get(calc.categoryId) ?? 0;
            agg[i].categoryExpense.set(calc.categoryId, prev + magnitude);
          }
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
      // P3 (Fase 1.1.1.ext): skip heredado de la cuota de origen (para este mes)
      // OR skip propio del calculado.
      for (const calc of calculadosDeCuotaAnual) {
        // RF-REP-015: calculados de cuota no entran en el tramo proyectado
        if (isFutureMonth) continue;

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
        if (groupData.skippedMonths.has(mes) || calc.skippedMonths.has(mes)) continue;

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
        if (!includeMovType('cuota')) continue;

        if (derivedType === MovementType.INCOME) {
          if (dir !== 'expense') agg[i].incomeCents += magnitude;
        } else {
          if (dir !== 'income') {
            agg[i].expenseCents += magnitude;
            const prev = agg[i].categoryExpense.get(calc.categoryId) ?? 0;
            agg[i].categoryExpense.set(calc.categoryId, prev + magnitude);
          }
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

        // RF-REP-015: cuotas no entran en el tramo proyectado
        if (projectFixed === true && mes > todayMonthKey) continue;

        // P3 (Fase 1.1.1.ext): la instancia (mes) de la cuota está anulada
        if (grupo.skippedMonths.has(mes)) continue;

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
        if (!includeMovType('cuota')) continue;

        if (grupo.type === 'INCOME') {
          if (dir !== 'expense') agg[i].incomeCents += convertedAmount;
        } else {
          if (dir !== 'income') {
            agg[i].expenseCents += convertedAmount;
            const prev = agg[i].categoryExpense.get(grupo.categoryId) ?? 0;
            agg[i].categoryExpense.set(
              grupo.categoryId,
              prev + convertedAmount,
            );
          }
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
      // RF-REP-015: projected=true solo cuando el flag está activo y el mes es futuro.
      // false cuando el flag está off (back-compat dura: comportamiento actual sin cambio).
      projected: projectFixed === true && month > todayMonthKey,
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
        typeSet: typeSet !== null ? [...typeSet] : null,
        direction: dir,
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
   *
   * Ancla editable de la escala de color (P3):
   *   anchorAmountCents/anchorCurrency — par opcional (monto en centavos, moneda) que
   *   reemplaza el default de 15 USD como base de `colorAnchorCents`. Se convierte a
   *   USD cents con el mismo TC de enero del año (pivotRatesForYear) que ya usa el
   *   cálculo de colorAnchorCents. Ausentes → default 1500 (15 USD).
   */
  async getAnnualUnicosReport(
    userId: string,
    year: number,
    categoryIds?: string[] | null,
    currencyOverride?: Currency | null,
    today?: string,
    anchorAmountCents?: number,
    anchorCurrency?: Currency,
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
    // colorAnchorCents — ancla de escala de color para el frontend (P3: editable)
    //
    // Base: anchorUsdCents. Por default 1500 centavos (15 USD). Si el caller pasó
    // anchorAmountCents/anchorCurrency, se convierte ese par a USD cents con el TC
    // de enero del año pedido (mismo pivotRatesForYear/clamp que el resto del bloque)
    // y ESE valor reemplaza al default como base.
    //
    // colorAnchorCents = anchorUsdCents reconvertido a la moneda de display, usando
    // el mismo TC de enero del año pedido (`${year}-01` resuelto vía pivotRatesForYear,
    // que ya clampea al mes más cercano si enero no tiene datos en la tabla).
    //
    // Cuando displayCurrency == USD → anchorUsdCents directos (sin conversión).
    // Para otras monedas → deriveExchangeRate(USD, displayCurrency, pivotRates)
    // aplicado sobre anchorUsdCents, redondeado a centavos enteros.
    // ---------------------------------------------------------------------------
    const DEFAULT_ANCHOR_USD_CENTS = 1500; // 15 USD en centavos

    // Usar el TC de enero del año pedido (ya clampeado por loadPivotRatesForYear)
    const januaryKey = `${yearStr}-01`;
    const pivotRatesJanuary = pivotRatesForYear.get(januaryKey) ?? null;

    let anchorUsdCents: number;
    if (anchorAmountCents !== undefined && anchorCurrency !== undefined) {
      if (anchorCurrency === Currency.USD) {
        anchorUsdCents = anchorAmountCents;
      } else {
        // deriveExchangeRate(currency, anchorCurrency, pivotRates) devuelve
        // "unidades de anchorCurrency por 1 unidad de currency". Acá pedimos
        // "unidades de USD por 1 unidad de anchorCurrency" invirtiendo los args:
        // currency=anchorCurrency (el del input), anchorCurrency=USD (el destino).
        const rate = deriveExchangeRate(anchorCurrency, Currency.USD, pivotRatesJanuary);
        // Si no hay datos de referencia (tabla vacía), usar el default como fallback defensivo.
        anchorUsdCents = rate !== null ? Math.round(anchorAmountCents * rate) : DEFAULT_ANCHOR_USD_CENTS;
      }
    } else {
      anchorUsdCents = DEFAULT_ANCHOR_USD_CENTS;
    }

    let colorAnchorCents: number;
    if (displayCurrency === Currency.USD) {
      colorAnchorCents = anchorUsdCents;
    } else {
      const rate = deriveExchangeRate(Currency.USD, displayCurrency, pivotRatesJanuary);
      // Si no hay datos de referencia (tabla vacía), usar anchorUsdCents como fallback defensivo.
      colorAnchorCents = rate !== null ? Math.round(anchorUsdCents * rate) : anchorUsdCents;
    }

    this.logger.debug(
      {
        userId,
        year,
        displayCurrency,
        filterCount: filterSet?.size ?? null,
        availableCategoriesCount: availableCategories.length,
        anchorUsdCents,
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
      anchorUsdCents,
    };
  }

  // ---------------------------------------------------------------------------
  // Reporte anual de cuotas — gantt (Ola 3 / P2)
  // ---------------------------------------------------------------------------

  /**
   * Devuelve el gantt anual de cuotas EXPENSE del usuario para el año dado.
   *
   * Parámetros:
   *   userId           — scopea todos los datos.
   *   year             — año pedido (4 dígitos).
   *   categoryIds      — null = todas; [] = ninguna (bars vacío); [...] = subconjunto.
   *                      El filtro se aplica ANTES del packing.
   *   currencyOverride — override de display; null/undefined = default del usuario.
   *
   * Algoritmo de packing:
   *   1. Filtrar barras que intersectan el año (startMonth < endMonth del año,
   *      con endMonth = addMonths(startMonth, totalInstallments)).
   *   2. Ordenar por createdAt ASC (ya vienen ordenadas desde el repo).
   *   3. Asignar rowIndex empezando en 0. Cada renglón mantiene la lista de todos
   *      sus intervalos [s, e] ya asignados. Una barra [s, e] cabe en un renglón
   *      si no entra en conflicto con NINGÚN intervalo existente: sin conflicto con
   *      [s2, e2] significa s >= e2 + 2 (va después, ≥1 mes de descanso) o
   *      e <= s2 - 2 (va antes, ≥1 mes de descanso). Aprovecha huecos intermedios.
   *      Si ningún renglón existente la admite, sube a un renglón nuevo.
   *
   * TC de conversión del amountCents por cuota:
   *   - Si startMonth cae dentro del año pedido → TC del startMonth.
   *   - Si startMonth es anterior al año pedido → TC de enero del año (YYYY-01).
   *   Coherente con P3: cuotas usan TC oficial del mes de la instancia.
   */
  async getAnnualCuotasReport(
    userId: string,
    year: number,
    categoryIds?: string[] | null,
    currencyOverride?: Currency | null,
  ): Promise<AnnualCuotasResponse> {
    // Normalizar filtro de categorías (misma semántica que los otros reportes)
    const filterSet: Set<string> | null =
      categoryIds === null || categoryIds === undefined
        ? null
        : categoryIds.length === 0
          ? new Set<string>()
          : new Set(categoryIds);

    const yearStr = String(year).padStart(4, '0');
    // Primer y último mes del año (YYYY-MM), para cálculo de intersección
    const yearStart = `${yearStr}-01`; // enero del año
    const yearEnd = `${yearStr}-12`;   // diciembre del año (último mes visible)
    // Mes siguiente al último del año (exclusivo superior de rango)
    const yearAfter = `${String(year + 1).padStart(4, '0')}-01`;

    // Cargar moneda de display y pivot rates del año en paralelo
    const [userSettings, pivotRatesForYear, allGroups] = await Promise.all([
      this.settingsService.getSettings(userId),
      this.repo.loadPivotRatesForYear(year),
      this.repo.getAllCuotasForGantt(userId),
    ]);
    const displayCurrency: Currency =
      currencyOverride != null ? currencyOverride : userSettings.defaultCurrency;

    // ---------------------------------------------------------------------------
    // 1. Filtrar grupos que intersectan el año pedido
    //    Condición: startMonth <= yearEnd && endMonth (exclusivo) > yearStart
    //    (equivale a: la cuota ocupa al menos un mes dentro del año)
    // ---------------------------------------------------------------------------
    const intersecting = allGroups.filter((g) => {
      const endMonth = addMonths(g.startMonth, g.totalInstallments); // exclusivo
      return g.startMonth <= yearEnd && endMonth > yearStart;
    });

    // ---------------------------------------------------------------------------
    // 2. Construir el universo estable de categorías (SIN aplicar filterSet),
    //    para poblar availableCategories. Acumulamos la suma de meses visibles
    //    del año en displayCurrency por categoría.
    // ---------------------------------------------------------------------------
    const catMetaAll = new Map<string, { name: string; color: string }>();
    const annualAmountAll = new Map<string, number>();

    for (const g of intersecting) {
      // Primer mes visible: max(startMonth, yearStart)
      const firstVisibleMonth = g.startMonth >= yearStart ? g.startMonth : yearStart;
      // TC: primer mes visible de la barra en el año
      const tcMonth = firstVisibleMonth <= yearEnd ? firstVisibleMonth : yearStart;
      const pivotRates = pivotRatesForYear.get(tcMonth) ?? null;
      const convertedAmount = convertToDisplayCurrencyByMonth(
        g.amountCents,
        g.currency,
        displayCurrency,
        pivotRates,
        g.exchangeRate,
        g.anchorCurrency,
      );

      if (!catMetaAll.has(g.categoryId)) {
        catMetaAll.set(g.categoryId, { name: g.categoryName, color: g.categoryColor });
      }
      // Sumar el monto convertido × meses visibles en el año (para ranking)
      const endMonth = addMonths(g.startMonth, g.totalInstallments);
      const visibleStart = g.startMonth >= yearStart ? g.startMonth : yearStart;
      const visibleEnd = endMonth <= yearAfter ? endMonth : yearAfter;
      const visibleMonths = monthDiff(visibleStart, visibleEnd);
      annualAmountAll.set(
        g.categoryId,
        (annualAmountAll.get(g.categoryId) ?? 0) + convertedAmount * visibleMonths,
      );
    }

    // ---------------------------------------------------------------------------
    // 3. Aplicar filtro de categorías al conjunto intersectante
    // ---------------------------------------------------------------------------
    const filtered =
      filterSet === null
        ? intersecting
        : filterSet.size === 0
          ? []
          : intersecting.filter((g) => filterSet.has(g.categoryId));

    // ---------------------------------------------------------------------------
    // 4. Packing: ordenado por startMonth ASC (origen real de la cuota = mes de la
    //    primera cuota del grupo), desempate secundario por createdAt ASC para
    //    determinismo cuando dos grupos tienen el mismo startMonth.
    //    Las cuotas que arrancan antes en el tiempo quedan en el renglón más
    //    cercano al eje (row0); las que arrancan después suben.
    //
    //    IMPORTANTE: el orden de procesamiento usa g.startMonth (puede ser de un
    //    año anterior al pedido), mientras que startMonthIndex/endMonthIndex
    //    (usados para verificar conflictos/descanso) están recortados al año visible
    //    (0–11). Son dos cosas distintas; el sort se hace ANTES de calcular los
    //    índices recortados.
    //
    //    Algoritmo de huecos: cada renglón mantiene la lista de TODOS los
    //    intervalos [s, e] ya asignados. Una barra [s, e] cabe en un renglón si
    //    no entra en conflicto con NINGÚN intervalo existente. Sin conflicto con
    //    [s2, e2] significa:
    //      s >= e2 + 2  (va después con ≥1 mes de descanso)  o
    //      e <= s2 - 2  (va antes con ≥1 mes de descanso)
    //    Esto aprovecha los huecos entre barras ya asignadas (el algoritmo anterior
    //    solo comparaba contra el último end, ignorando huecos intermedios).
    // ---------------------------------------------------------------------------
    // Reordenar por origen real de la cuota (startMonth ASC), desempate createdAt ASC.
    // No confiar en el orden createdAt del repo para el packing.
    const sortedForPacking = [...filtered].sort((a, b) => {
      if (a.startMonth < b.startMonth) return -1;
      if (a.startMonth > b.startMonth) return 1;
      // Desempate: createdAt ASC (o id si no tienen createdAt)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // rowIntervals[rowIndex] = lista de intervalos [s, e] (ambos inclusivos, 0–11)
    //                          asignados a ese renglón.
    const rowIntervals: Array<Array<[number, number]>> = [];

    const bars: GanttBar[] = [];

    for (const g of sortedForPacking) {
      const endMonth = addMonths(g.startMonth, g.totalInstallments); // exclusivo

      // Índices de mes en el año (0-based, recortados a 0–11)
      const continuesBefore = g.startMonth < yearStart;
      const continuesAfter = endMonth > yearAfter;

      // Primer y último mes VISIBLE dentro del año pedido
      const visibleStartMonth = continuesBefore ? yearStart : g.startMonth;
      const visibleEndMonthExclusive = continuesAfter ? yearAfter : endMonth;

      // startMonthIndex: 0-based dentro del año
      const startMonthIndex = monthDiff(yearStart, visibleStartMonth); // 0..11
      // endMonthIndex: último mes visible, inclusivo (0-based)
      const endMonthIndex = monthDiff(yearStart, visibleEndMonthExclusive) - 1; // 0..11

      // Número de cuota visible en startMonthIndex e endMonthIndex
      const installmentFrom = monthDiff(g.startMonth, visibleStartMonth) + 1;
      const installmentTo = monthDiff(g.startMonth, visibleEndMonthExclusive); // last cuota inclusiva

      // Rango real de la cuota (no recortado al año pedido).
      // realStartMonth = mes de la primera cuota = startMonth del grupo.
      // realEndMonth   = mes de la última cuota  = startMonth + (totalInstallments - 1) meses.
      const realStartMonth = g.startMonth;
      const realEndMonth = addMonths(g.startMonth, g.totalInstallments - 1);

      // TC: primer mes visible en el año
      const tcMonth = visibleStartMonth;
      const pivotRates = pivotRatesForYear.get(tcMonth) ?? null;
      const convertedAmount = convertToDisplayCurrencyByMonth(
        g.amountCents,
        g.currency,
        displayCurrency,
        pivotRates,
        g.exchangeRate,
        g.anchorCurrency,
      );

      // Asignar renglón: elegir el renglón más bajo (índice menor) donde la barra
      // no entre en conflicto con ningún intervalo ya asignado a ese renglón.
      // Sin conflicto con [s2, e2]: s >= e2 + 2 (va después) o e <= s2 - 2 (va antes).
      let assignedRow = -1;
      for (let r = 0; r < rowIntervals.length; r++) {
        const intervals = rowIntervals[r];
        const fits = intervals.every(
          ([s2, e2]) =>
            startMonthIndex >= e2 + 2 || endMonthIndex <= s2 - 2,
        );
        if (fits) {
          assignedRow = r;
          break;
        }
      }
      if (assignedRow === -1) {
        // No cabe en ningún renglón existente → nuevo renglón
        assignedRow = rowIntervals.length;
        rowIntervals.push([[startMonthIndex, endMonthIndex]]);
      } else {
        rowIntervals[assignedRow].push([startMonthIndex, endMonthIndex]);
      }

      bars.push({
        id: g.id,
        description: g.description,
        categoryId: g.categoryId,
        amountCents: convertedAmount,
        startMonthIndex,
        endMonthIndex,
        continuesBefore,
        continuesAfter,
        installmentFrom,
        installmentTo,
        totalInstallments: g.totalInstallments,
        rowIndex: assignedRow,
        realStartMonth,
        realEndMonth,
      });
    }

    // Ordenar barras por rowIndex ASC, luego startMonthIndex ASC (para comodidad del front)
    bars.sort((a, b) =>
      a.rowIndex !== b.rowIndex
        ? a.rowIndex - b.rowIndex
        : a.startMonthIndex - b.startMonthIndex,
    );

    const rowCount = rowIntervals.length;

    // ---------------------------------------------------------------------------
    // 5. Construir availableCategories (universo sin filtro, sin conversión doble)
    // ---------------------------------------------------------------------------
    const availableCategories: AvailableCategory[] = Array.from(catMetaAll.entries())
      .map(([categoryId, meta]) => ({ categoryId, name: meta.name, color: meta.color }))
      .sort((a, b) => {
        const totalA = annualAmountAll.get(a.categoryId) ?? 0;
        const totalB = annualAmountAll.get(b.categoryId) ?? 0;
        if (totalB !== totalA) return totalB - totalA;
        return a.categoryId.localeCompare(b.categoryId);
      });

    this.logger.debug(
      {
        userId,
        year,
        displayCurrency,
        filterCount: filterSet?.size ?? null,
        intersectingCount: intersecting.length,
        filteredCount: filtered.length,
        rowCount,
        availableCategoriesCount: availableCategories.length,
      },
      'Reporte anual de cuotas (gantt) calculado',
    );

    return {
      year,
      currency: displayCurrency,
      bars,
      rowCount,
      availableCategories,
    };
  }

  // ---------------------------------------------------------------------------
  // Reporte anual de inflación vs ingresos — P5
  // ---------------------------------------------------------------------------

  /**
   * Devuelve el reporte anual de inflación vs ingresos del usuario para el año dado.
   *
   * Por cada mes calcula:
   *   inflationPct  — InflationRate.monthlyVariation (puntos %) del mes.
   *   incomePct     — ROUNDDOWN((ingresoCurrent×100/ingresoPrev)−100, 2), truncado.
   *                   El mes anterior de enero = diciembre del año previo.
   *                   null si el mes es futuro del año en curso, o si ingresoPrev==0.
   *   incomePctAdj  — igual pero ingresoPrev *= (1 + inflationPct/100) antes de comparar.
   *                   null si falta IPC, si el mes es futuro, o si ingresoPrev==0.
   *
   * "Ingreso del mes" = suma de INCOME de todos los orígenes (únicos + fijos + cuotas),
   * con el mismo criterio de imputación por mes que la serie de reportes.
   *
   * El filtro de categorías restringe qué ingresos cuentan; earliestYear y
   * availableCategories (universo de categorías con INCOME en el año) ignoran el filtro.
   *
   * El "mes en curso" usa el total a la fecha (no nulo) pero la variación es nula para
   * meses futuros del año en curso (igual criterio que dailyAvg en annual-unicos).
   */
  async getAnnualInflationIncomeReport(
    userId: string,
    year: number,
    categoryIds?: string[] | null,
    currencyOverride?: Currency | null,
    today?: string,
  ): Promise<AnnualInflationIncomeResponse> {
    // Normalizar filtro de categorías
    const filterSet: Set<string> | null =
      categoryIds === null || categoryIds === undefined
        ? null
        : categoryIds.length === 0
          ? new Set<string>()
          : new Set(categoryIds);

    // Determinar fecha "hoy" para determinar meses futuros
    const todayDate = today ? new Date(today + 'T00:00:00Z') : new Date();
    const todayYear = todayDate.getUTCFullYear();
    const todayMonth = todayDate.getUTCMonth() + 1; // 1-based

    const yearStr = String(year).padStart(4, '0');
    const prevYearStr = String(year - 1).padStart(4, '0');
    const prevDecKey = `${prevYearStr}-12`;
    const months12: string[] = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${yearStr}-${m}`;
    });

    // Cargar en paralelo: settings, pivot rates, inflation rates, únicos del año,
    // únicos del mes anterior al año (dic previo), fijos y cuotas
    const [
      userSettings,
      pivotRatesForYear,
      inflationRates,
      unicosYear,
      unicosPrevDec,
      allFijos,
      allCuotas,
      earliestYear,
    ] = await Promise.all([
      this.settingsService.getSettings(userId),
      this.repo.loadPivotRatesForYear(year),
      this.repo.loadInflationRatesForYear(year),
      this.repo.getAnnualUnicosAggregated(userId, year),
      this.repo.getUnicosIncomeForMonth(userId, prevDecKey),
      this.repo.getAllFijosForAnnual(userId),
      this.repo.getAllCuotasForAnnual(userId),
      this.repo.getEarliestYear(userId),
    ]);

    const displayCurrency: Currency =
      currencyOverride != null ? currencyOverride : userSettings.defaultCurrency;

    // ---------------------------------------------------------------------------
    // Separar fijos en normales y calculados
    // ---------------------------------------------------------------------------
    const normalesForAnnual = allFijos.filter(
      (f) => f.sourceChainId === null && f.sourceMovementId === null && f.sourceInstallmentGroupId === null,
    );
    const calculadosDeFijoAnual = allFijos.filter((f) => f.sourceChainId !== null);
    const calculadosDeUnicoAnual = allFijos.filter((f) => f.sourceMovementId !== null);
    const calculadosDeCuotaAnual = allFijos.filter((f) => f.sourceInstallmentGroupId !== null);

    // Cargar Transactions y Groups de origen para calculados (una sola query cada uno)
    const txIdsAnual = [...new Set(calculadosDeUnicoAnual.map((f) => f.sourceMovementId!).filter(Boolean))];
    const txAnualMap = new Map<string, { amountCents: number; currency: Currency; exchangeRate: number; anchorCurrency: Currency; skipped: boolean }>();
    if (txIdsAnual.length > 0) {
      const txRows = await this.repo.findTransactionsByIds(txIdsAnual);
      for (const tx of txRows) txAnualMap.set(tx.id, {
        amountCents: tx.amountCents,
        currency: tx.currency,
        exchangeRate: tx.exchangeRate,
        anchorCurrency: tx.anchorCurrency,
        skipped: tx.skipped,
      });
    }

    const groupIdsAnual = [...new Set(calculadosDeCuotaAnual.map((f) => f.sourceInstallmentGroupId!).filter(Boolean))];
    const groupAnualMap = new Map<string, {
      amountCents: number;
      totalInstallments: number;
      startMonth: string;
      currency: Currency;
      exchangeRate: number;
      anchorCurrency: Currency;
      skippedMonths: Set<string>;
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
        skippedMonths: g.skippedMonths,
      });
    }

    // ---------------------------------------------------------------------------
    // Universo estable de categorías con INCOME en el año (sin filtro)
    // ---------------------------------------------------------------------------
    const catMetaAll = new Map<string, AnnualCategoryMeta>();
    const annualIncomeAll = new Map<string, number>();

    // Función de acumulación al universo (solo para INCOME, sin filtro)
    const accumulateUniverse = (categoryId: string, name: string, color: string, cents: number) => {
      if (!catMetaAll.has(categoryId)) {
        catMetaAll.set(categoryId, { categoryId, name, color });
      }
      annualIncomeAll.set(categoryId, (annualIncomeAll.get(categoryId) ?? 0) + cents);
    };

    // ---------------------------------------------------------------------------
    // Acumular ingresos por mes: [0..11] = enero..diciembre
    // monthIncome[i] = total de INCOME del mes i+1
    // ---------------------------------------------------------------------------
    const monthIncome: number[] = new Array(12).fill(0);

    // 1. Únicos INCOME del año
    for (const row of unicosYear) {
      if (row.type !== 'INCOME') continue;
      const idx = parseInt(row.monthKey.split('-')[1], 10) - 1;
      if (idx < 0 || idx > 11) continue;

      const pivotRates = pivotRatesForYear.get(row.monthKey) ?? null;
      const cents = convertToDisplayCurrency(
        Number(row.totalCents),
        row.currency as Currency,
        Number(row.exchangeRate),
        row.anchorCurrency as Currency,
        displayCurrency,
        pivotRates,
      );

      accumulateUniverse(row.categoryId, row.categoryName, row.categoryColor, cents);

      if (filterSet === null || filterSet.has(row.categoryId)) {
        monthIncome[idx] += cents;
      }
    }

    // 2. Fijos e ingresos derivados, mes por mes
    for (let i = 0; i < 12; i++) {
      const mes = months12[i];
      const pivotRates = pivotRatesForYear.get(mes) ?? null;

      // Mapa chainId → datos del normal activo en este mes (para calculados de fijo)
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

      // Fijos normales INCOME
      for (const fijo of normalesForAnnual) {
        if (fijo.type !== 'INCOME') continue;
        const inRange =
          fijo.startMonth <= mes &&
          (fijo.deletedFrom === null || fijo.deletedFrom > mes);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, mes)) continue;
        if (fijo.skippedMonths.has(mes)) continue;

        const convertedAmount = convertToDisplayCurrencyByMonth(
          fijo.amountCents,
          fijo.currency,
          displayCurrency,
          pivotRates,
          fijo.exchangeRate,
          fijo.anchorCurrency,
        );

        accumulateUniverse(fijo.categoryId, fijo.categoryName, fijo.categoryColor, convertedAmount);
        if (filterSet === null || filterSet.has(fijo.categoryId)) {
          monthIncome[i] += convertedAmount;
        }
      }

      // Calculados de fijo
      for (const calc of calculadosDeFijoAnual) {
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const originData = calc.sourceChainId
          ? normalesActivosMes.get(calc.sourceChainId)
          : undefined;
        if (!originData) continue;
        if (originData.skipped || calc.skippedMonths.has(mes)) continue;

        const derivedAmount = applyFormula(
          originData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
        if (derivedType !== MovementType.INCOME) continue;

        const magnitude = convertToDisplayCurrencyByMonth(
          Math.abs(derivedAmount),
          originData.currency,
          displayCurrency,
          pivotRates,
          originData.exchangeRate,
          originData.anchorCurrency,
        );

        accumulateUniverse(calc.categoryId, calc.categoryName, calc.categoryColor, magnitude);
        if (filterSet === null || filterSet.has(calc.categoryId)) {
          monthIncome[i] += magnitude;
        }
      }

      // Calculados de único
      for (const calc of calculadosDeUnicoAnual) {
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const txData = calc.sourceMovementId ? txAnualMap.get(calc.sourceMovementId) : undefined;
        if (!txData) continue;
        if (txData.skipped || calc.skippedMonths.has(mes)) continue;

        const derivedAmount = applyFormula(
          txData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
        if (derivedType !== MovementType.INCOME) continue;

        const magnitude = convertToDisplayCurrency(
          Math.abs(derivedAmount),
          txData.currency,
          txData.exchangeRate,
          txData.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        accumulateUniverse(calc.categoryId, calc.categoryName, calc.categoryColor, magnitude);
        if (filterSet === null || filterSet.has(calc.categoryId)) {
          monthIncome[i] += magnitude;
        }
      }

      // Calculados de cuota
      for (const calc of calculadosDeCuotaAnual) {
        const inRange =
          calc.startMonth <= mes &&
          (calc.deletedFrom === null || calc.deletedFrom > mes);
        if (!inRange) continue;

        const groupData = calc.sourceInstallmentGroupId
          ? groupAnualMap.get(calc.sourceInstallmentGroupId)
          : undefined;
        if (!groupData) continue;

        const endMonth = addMonths(groupData.startMonth, groupData.totalInstallments);
        if (mes >= endMonth) continue;
        if (groupData.skippedMonths.has(mes) || calc.skippedMonths.has(mes)) continue;

        const derivedAmount = applyFormula(
          groupData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
        if (derivedType !== MovementType.INCOME) continue;

        const magnitude = convertToDisplayCurrencyByMonth(
          Math.abs(derivedAmount),
          groupData.currency,
          displayCurrency,
          pivotRates,
          groupData.exchangeRate,
          groupData.anchorCurrency,
        );

        accumulateUniverse(calc.categoryId, calc.categoryName, calc.categoryColor, magnitude);
        if (filterSet === null || filterSet.has(calc.categoryId)) {
          monthIncome[i] += magnitude;
        }
      }

      // Cuotas INCOME
      for (const grupo of allCuotas) {
        if (grupo.type !== 'INCOME') continue;
        const endMonth = addMonths(grupo.startMonth, grupo.totalInstallments);
        if (grupo.startMonth > mes || mes >= endMonth) continue;
        if (grupo.skippedMonths.has(mes)) continue;

        const convertedAmount = convertToDisplayCurrencyByMonth(
          grupo.amountCents,
          grupo.currency,
          displayCurrency,
          pivotRates,
          grupo.exchangeRate,
          grupo.anchorCurrency,
        );

        accumulateUniverse(grupo.categoryId, grupo.categoryName, grupo.categoryColor, convertedAmount);
        if (filterSet === null || filterSet.has(grupo.categoryId)) {
          monthIncome[i] += convertedAmount;
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Calcular ingreso de diciembre del año previo (para la variación de enero)
    // Incluye únicos, fijos y cuotas de ese mes.
    // ---------------------------------------------------------------------------

    // Pivot rates para diciembre del año previo: usamos el rate más cercano disponible.
    // loadPivotRatesForYear solo carga los 12 meses del año pedido; para el mes previo
    // usamos la clave de enero como proxy al más antiguo disponible, igual que anual-unicos.
    // Como clamping: si no hay pivotRate para prevDec, usamos el de enero del año (fallback).
    const januaryKey = `${yearStr}-01`;
    const pivotRatesPrevDec = pivotRatesForYear.get(januaryKey) ?? null;

    let prevDecIncome = 0;

    // Únicos INCOME de diciembre del año previo
    for (const row of unicosPrevDec) {
      const cents = convertToDisplayCurrency(
        Number(row.totalCents),
        row.currency as Currency,
        Number(row.exchangeRate),
        row.anchorCurrency as Currency,
        displayCurrency,
        pivotRatesPrevDec,
      );
      if (filterSet === null || filterSet.has(row.categoryId)) {
        prevDecIncome += cents;
      }
    }

    // Fijos INCOME activos en diciembre del año previo
    for (const fijo of normalesForAnnual) {
      if (fijo.type !== 'INCOME') continue;
      const inRange =
        fijo.startMonth <= prevDecKey &&
        (fijo.deletedFrom === null || fijo.deletedFrom > prevDecKey);
      if (!inRange) continue;
      if (!isOnFrequency(fijo.startMonth, fijo.frequency, prevDecKey)) continue;
      if (fijo.skippedMonths.has(prevDecKey)) continue;

      const convertedAmount = convertToDisplayCurrencyByMonth(
        fijo.amountCents,
        fijo.currency,
        displayCurrency,
        pivotRatesPrevDec,
        fijo.exchangeRate,
        fijo.anchorCurrency,
      );
      if (filterSet === null || filterSet.has(fijo.categoryId)) {
        prevDecIncome += convertedAmount;
      }
    }

    // Calculados de fijo INCOME activos en diciembre del año previo
    {
      const normalesMes = new Map<string, { amountCents: number; skipped: boolean; startMonth: string; currency: Currency; exchangeRate: number; anchorCurrency: Currency }>();
      for (const fijo of normalesForAnnual) {
        const inRange = fijo.startMonth <= prevDecKey && (fijo.deletedFrom === null || fijo.deletedFrom > prevDecKey);
        if (!inRange) continue;
        if (!isOnFrequency(fijo.startMonth, fijo.frequency, prevDecKey)) continue;
        const existing = normalesMes.get(fijo.chainId);
        if (!existing || fijo.startMonth > existing.startMonth) {
          normalesMes.set(fijo.chainId, { amountCents: fijo.amountCents, skipped: fijo.skippedMonths.has(prevDecKey), startMonth: fijo.startMonth, currency: fijo.currency, exchangeRate: fijo.exchangeRate, anchorCurrency: fijo.anchorCurrency });
        }
      }
      for (const calc of calculadosDeFijoAnual) {
        const inRange = calc.startMonth <= prevDecKey && (calc.deletedFrom === null || calc.deletedFrom > prevDecKey);
        if (!inRange) continue;
        const originData = calc.sourceChainId ? normalesMes.get(calc.sourceChainId) : undefined;
        if (!originData) continue;
        if (originData.skipped || calc.skippedMonths.has(prevDecKey)) continue;
        const derivedAmount = applyFormula(originData.amountCents, calc.formulaOperator as FormulaOperator, calc.formulaOperand!, calc.formulaSign!);
        if (derivedAmount <= 0) continue;
        const magnitude = convertToDisplayCurrencyByMonth(Math.abs(derivedAmount), originData.currency, displayCurrency, pivotRatesPrevDec, originData.exchangeRate, originData.anchorCurrency);
        if (filterSet === null || filterSet.has(calc.categoryId)) {
          prevDecIncome += magnitude;
        }
      }
    }

    // Calculados de único INCOME activos en diciembre del año previo
    for (const calc of calculadosDeUnicoAnual) {
      const inRange = calc.startMonth <= prevDecKey && (calc.deletedFrom === null || calc.deletedFrom > prevDecKey);
      if (!inRange) continue;
      const txData = calc.sourceMovementId ? txAnualMap.get(calc.sourceMovementId) : undefined;
      if (!txData) continue;
      if (txData.skipped || calc.skippedMonths.has(prevDecKey)) continue;
      const derivedAmount = applyFormula(txData.amountCents, calc.formulaOperator as FormulaOperator, calc.formulaOperand!, calc.formulaSign!);
      if (derivedAmount <= 0) continue;
      const magnitude = convertToDisplayCurrency(Math.abs(derivedAmount), txData.currency, txData.exchangeRate, txData.anchorCurrency, displayCurrency, pivotRatesPrevDec);
      if (filterSet === null || filterSet.has(calc.categoryId)) {
        prevDecIncome += magnitude;
      }
    }

    // Calculados de cuota INCOME activos en diciembre del año previo
    for (const calc of calculadosDeCuotaAnual) {
      const inRange = calc.startMonth <= prevDecKey && (calc.deletedFrom === null || calc.deletedFrom > prevDecKey);
      if (!inRange) continue;
      const groupData = calc.sourceInstallmentGroupId ? groupAnualMap.get(calc.sourceInstallmentGroupId) : undefined;
      if (!groupData) continue;
      const endMonth = addMonths(groupData.startMonth, groupData.totalInstallments);
      if (prevDecKey >= endMonth) continue;
      if (groupData.skippedMonths.has(prevDecKey) || calc.skippedMonths.has(prevDecKey)) continue;
      const derivedAmount = applyFormula(groupData.amountCents, calc.formulaOperator as FormulaOperator, calc.formulaOperand!, calc.formulaSign!);
      if (derivedAmount <= 0) continue;
      const magnitude = convertToDisplayCurrencyByMonth(Math.abs(derivedAmount), groupData.currency, displayCurrency, pivotRatesPrevDec, groupData.exchangeRate, groupData.anchorCurrency);
      if (filterSet === null || filterSet.has(calc.categoryId)) {
        prevDecIncome += magnitude;
      }
    }

    // Cuotas INCOME activas en diciembre del año previo
    for (const grupo of allCuotas) {
      if (grupo.type !== 'INCOME') continue;
      const endMonth = addMonths(grupo.startMonth, grupo.totalInstallments);
      if (grupo.startMonth > prevDecKey || prevDecKey >= endMonth) continue;
      if (grupo.skippedMonths.has(prevDecKey)) continue;
      const convertedAmount = convertToDisplayCurrencyByMonth(
        grupo.amountCents,
        grupo.currency,
        displayCurrency,
        pivotRatesPrevDec,
        grupo.exchangeRate,
        grupo.anchorCurrency,
      );
      if (filterSet === null || filterSet.has(grupo.categoryId)) {
        prevDecIncome += convertedAmount;
      }
    }

    // ---------------------------------------------------------------------------
    // Construir los 12 meses del reporte
    // ---------------------------------------------------------------------------
    const months: AnnualInflationIncomeMonth[] = [];
    // incomePct values para la regresión (incluyendo nulls — OLS solo usa no-nulos)
    const incomePctValues: (number | null)[] = [];
    const incomePctAdjValues: (number | null)[] = [];

    let prevMonthIncome: number = prevDecIncome;

    for (let i = 0; i < 12; i++) {
      const monthNum = i + 1;
      const monthKey = months12[i];
      const inflationPct: number | null = inflationRates.get(monthKey) ?? null;

      // Determinar si el mes es futuro (sin dato de variación)
      const isFuture =
        year > todayYear ||
        (year === todayYear && monthNum > todayMonth);

      const currentIncome = monthIncome[i];

      // incomePct: variación MoM del ingreso total
      let incomePct: number | null = null;
      if (!isFuture && prevMonthIncome > 0) {
        incomePct = roundDown((currentIncome * 100) / prevMonthIncome - 100, 2);
      }

      // incomePctAdj: variación MoM ajustada por IPC
      let incomePctAdj: number | null = null;
      if (!isFuture && prevMonthIncome > 0 && inflationPct !== null) {
        const prevInflated = prevMonthIncome * (1 + inflationPct / 100);
        if (prevInflated > 0) {
          incomePctAdj = roundDown((currentIncome * 100) / prevInflated - 100, 2);
        }
      }

      months.push({ inflationPct, incomePct, incomePctAdj });
      incomePctValues.push(incomePct);
      incomePctAdjValues.push(incomePctAdj);

      // El ingreso de este mes es el "previo" del siguiente
      // Para meses futuros también actualizamos el previo para que las variaciones
      // futuras sean correctas (cuando llegue el tiempo, etc.)
      prevMonthIncome = currentIncome;
    }

    // ---------------------------------------------------------------------------
    // Calcular regresiones lineales por mínimos cuadrados
    // ---------------------------------------------------------------------------
    const incomeTrend = computeLinearTrend(incomePctValues);
    const incomeAdjTrend = computeLinearTrend(incomePctAdjValues);

    // ---------------------------------------------------------------------------
    // availableCategories: universo de categorías con INCOME del año, sin filtro,
    // ordenado por ingreso anual DESC, desempate categoryId ASC
    // ---------------------------------------------------------------------------
    const availableCategories: AvailableCategory[] = Array.from(catMetaAll.values()).sort((a, b) => {
      const totalA = annualIncomeAll.get(a.categoryId) ?? 0;
      const totalB = annualIncomeAll.get(b.categoryId) ?? 0;
      if (totalB !== totalA) return totalB - totalA;
      return a.categoryId.localeCompare(b.categoryId);
    });

    this.logger.debug(
      {
        userId,
        year,
        displayCurrency,
        filterCount: filterSet?.size ?? null,
        availableCategoriesCount: availableCategories.length,
        earliestYear,
      },
      'Reporte anual de inflación vs ingresos calculado',
    );

    return {
      year,
      currency: displayCurrency,
      months,
      incomeTrend,
      incomeAdjTrend,
      earliestYear,
      availableCategories,
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

/**
 * Calcula la regresión lineal por mínimos cuadrados sobre los valores no nulos.
 *
 * El índice de mes (0..11) es la variable independiente (x).
 * Requiere al menos 2 puntos para que la recta sea computable.
 *
 * Devuelve { slope, intercept, points } donde:
 *   slope     — pendiente de la recta
 *   intercept — ordenada en el origen
 *   points    — array de 12 valores y = slope*x + intercept para x = 0..11
 *               null si hay menos de 2 puntos no nulos
 */
export function computeLinearTrend(values: (number | null)[]): AnnualInflationIncomeTrend {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      points.push({ x: i, y: values[i] as number });
    }
  }

  if (points.length < 2) {
    return { slope: 0, intercept: 0, points: null };
  }

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);

  const denom = n * sumXX - sumX * sumX;
  // Si todas las x son iguales (caso degenerado), la recta no está determinada
  if (denom === 0) {
    return { slope: 0, intercept: sumY / n, points: null };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const trendPoints = Array.from({ length: 12 }, (_, i) => slope * i + intercept);
  return { slope, intercept, points: trendPoints };
}
