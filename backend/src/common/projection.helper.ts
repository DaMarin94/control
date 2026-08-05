import { Currency, FormulaOperator, MovementType } from '@prisma/client';
import { applyFormula } from '../recurring/formula.helper';
import { convertToDisplayCurrencyByMonth, PivotRates } from './currency.helper';
import { addMonths, isOnFrequency, monthDiff } from './month.helper';

// ---------------------------------------------------------------------------
// Motor de proyección — infraestructura compartida por dos features de
// dominio y método distintos (docs/requirements.md, RF-REP-015 nota):
//
//   1. computeFixedBasketProjection — RF-REP-015 (proyección de gastos fijos
//      en la serie de reportes): esqueleto determinista × tasa de
//      encarecimiento propia de cada cadena de fijo. Extraído tal cual estaba
//      embebido en MovementsService.getReportsMovements, SIN cambiar su
//      comportamiento observable.
//   2. fitCategoryRegression / evaluateRegressionAt — RF-SIM-002 (simulación
//      de categoría): regresión lineal por mínimos cuadrados sobre el total
//      mensual con signo de los únicos de una categoría.
//
// Ambas son "proyecciones a futuro sobre datos del usuario" pero de fórmula
// propia — lo que se comparte es este módulo, no la matemática de cada una.
//
// Deliberadamente son FUNCIONES PURAS EXPORTADAS (no una clase @Injectable
// con DI): así se pueden importar directo desde MovementsService y desde
// SimulationsService sin tocar la lista de providers de los tests unitarios
// existentes de RF-REP-015 (movements.reports.service.spec.ts construye
// MovementsService a mano con un set fijo de providers).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. RF-REP-015 — esqueleto determinista × tasa de precio same-basket
// ---------------------------------------------------------------------------

/** Fila mínima de un fijo NORMAL activo en alcance, tal como la necesita el motor. */
export interface FixedBasketChainRow {
  chainId: string;
  startMonth: string;
  deletedFrom: string | null;
  frequency: number;
  /** Meses (YYYY-MM) en que esta fila está anulada puntualmente (RecurringSkip). */
  skippedMonths: Set<string>;
  amountCents: number;
  currency: Currency;
  exchangeRate: number;
  anchorCurrency: Currency;
  categoryId: string;
  type: MovementType;
}

/** Fila mínima de un calculado-de-fijo, tal como la necesita el motor. */
export interface FixedBasketCalcRow {
  startMonth: string;
  deletedFrom: string | null;
  sourceChainId: string | null;
  skippedMonths: Set<string>;
  // Nullable en el tipo genérico de fila Recurring (una fila normal no lleva
  // fórmula) — en la práctica esta lista solo contiene calculados-de-fijo,
  // que siempre la tienen seteada (mismo trust que el código original).
  formulaOperator: FormulaOperator | null;
  formulaOperand: number | null;
  formulaSign: number | null;
  categoryId: string;
}

export interface FixedBasketProjectionParams {
  /** Mes actual "YYYY-MM" (mismo criterio que `today` del endpoint; A del cálculo). */
  todayMonthKey: string;
  /**
   * Pivot rates ya cargadas para TODOS los meses que el motor puede necesitar
   * (año pedido + años reales de la ventana backward + hoy). El caller es
   * responsable de esta carga (acceso a DB vía su propio repositorio).
   */
  extendedPivotRates: Map<string, Partial<PivotRates>>;
  normalesForAnnual: FixedBasketChainRow[];
  calculadosDeFijoAnual: FixedBasketCalcRow[];
  filterSet: Set<string> | null;
  dir: 'both' | 'expense' | 'income';
  includeMovType: (movType: 'fijo' | 'cuota' | 'unico') => boolean;
  displayCurrency: Currency;
}

export interface FixedBasketProjectionResult {
  lineRate: { expense: number; income: number };
  /** canasta_conocida(m) — total agregado (displayCurrency, cents) de fijos EN ALCANCE de una línea, en un mes arbitrario. */
  computeFixedLineTotal: (mes: string, lineType: 'EXPENSE' | 'INCOME') => number;
}

/**
 * RF-REP-015 — extraído de MovementsService.getReportsMovements tal cual
 * estaba (mismo comportamiento observable). Ver docs/backend.md, §Proyección
 * de fijos a futuro, para la regla de negocio completa.
 */
export function computeFixedBasketProjection(
  params: FixedBasketProjectionParams,
): FixedBasketProjectionResult {
  const {
    todayMonthKey,
    extendedPivotRates,
    normalesForAnnual,
    calculadosDeFijoAnual,
    filterSet,
    dir,
    includeMovType,
    displayCurrency,
  } = params;

  const lineRate: { expense: number; income: number } = { expense: 0, income: 0 };

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
          type: fijo.type,
        });
      }
    }
    return { activeByChain, pivotRates };
  };

  // canasta_conocida: total agregado (displayCurrency, cents) de fijos EN
  // ALCANCE de una línea, en un mes arbitrario `mes` — cada cadena a su
  // último monto conocido. Es la función que compone el futuro
  // determinísticamente (altas/bajas/fijo anual incluidos).
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
      // Filtro de categorías: solo aplica a la línea de gastos.
      if (lineType === 'EXPENSE' && filterSet !== null && !filterSet.has(data.categoryId)) continue;
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

  return { lineRate, computeFixedLineTotal };
}

// ---------------------------------------------------------------------------
// 2. RF-SIM-002 / RN-028 — regresión lineal por mínimos cuadrados
// ---------------------------------------------------------------------------

export interface LinearRegressionFit {
  slope: number;
  intercept: number;
}

/**
 * Ajusta una recta de mínimos cuadrados sobre `monthlyTotals` (longitud fija
 * 12: la ventana histórica `[A-12 .. A-1]`), con los puntos ocupando las
 * posiciones `1..12` del eje (RN-028 — el mes en curso `A` ocupa la posición
 * 13, aunque no entra al ajuste, y cada mes futuro la que le sigue).
 *
 * A diferencia de `computeLinearTrend` (usado por el reporte de Inflación vs
 * Ingresos), esta función NO saltea valores: los 12 puntos entran siempre
 * (RN-028 — "los meses sin únicos valen 0 y entran igual", la ausencia es
 * dato). El caller decide aparte si hay o no suficiente data para simular
 * (mínimo de 3 meses CON únicos, RF-SIM-002) — esta función solo ajusta.
 */
export function fitCategoryRegression(monthlyTotals: number[]): LinearRegressionFit {
  const n = monthlyTotals.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1; // posiciones 1..n (RN-028: A-12 = 1 ... A-1 = 12)
    const y = monthlyTotals[i];
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    // Caso degenerado (n <= 1): recta plana en el promedio.
    return { slope: 0, intercept: n > 0 ? sumY / n : 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Evalúa (extrapola) la recta ajustada en una posición arbitraria del eje. */
export function evaluateRegressionAt(fit: LinearRegressionFit, position: number): number {
  return fit.slope * position + fit.intercept;
}
