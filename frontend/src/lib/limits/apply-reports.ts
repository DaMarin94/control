/**
 * Cableado del evaluador de límites en el dashboard y en las 5 cards de
 * `/reportes` (P2 — Fase 1, Tramo 2). Espeja el patrón de `apply-month.ts`:
 * funciones PURAS (sin React/DOM) que mapean los datos ya renderizados de cada
 * superficie a sus keys del catálogo y devuelven las marcas evaluadas. Los
 * componentes de `components/charts/` y `components/dashboard/` solo llaman a
 * estos helpers y renderizan el resultado con las primitivas de
 * `components/limits/limit-mark.tsx` — no reimplementan la evaluación.
 *
 * Alcance de las keys que cablea este archivo:
 * - `reporte.ie.gastoMes` / `.ingresoMes` — income-expense (dashboard widget + card).
 * - `reporte.cat.gastoMesCategoria` / `.gastoMesTotal` — by-category (modo Barra).
 * - `reporte.unicos.celda` / `.mesTotal` / `.promedioDiario` / `.pctVsPrev` /
 *   `.inflacionMes` / `.pctVsPrevAjustado` — unique-grid.
 * - `reporte.cuotas.montoPorCuota` / `.cantidadCuotas` — installment-gantt.
 * - `reporte.infl.inflacionMes` / `.ingresoVarMes` / `.ingresoVarAjustado` — inflation-income.
 *
 * `mes.total.*` / `mes.balance` (reusados por el resumen del dashboard) NO
 * viven acá: se evalúan inline en `dashboard-client.tsx` con `evaluateLimits`
 * directo, igual que `month-view-client.tsx` (mismo criterio del Tramo 1).
 */

import type { LimitConfig } from "@/types/limit";
import { evaluateLimits, mergeLimitMarks, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { getCurrentMonth } from "@/lib/format";

// ─── Alcance temporal ("current") sobre datos anuales/multi-mes ────────────────

/**
 * True si (year, monthIndex 0-based) corresponde al mes real en curso
 * (`getCurrentMonth()`, zona del navegador) — gobierna `temporalScope: "current"`
 * sobre series anuales (ene..dic de un año navegable).
 */
export function isRealCurrentMonth(year: number, monthIndex: number): boolean {
  const current = getCurrentMonth(); // "YYYY-MM"
  const parts = current.split("-");
  const curYear = Number(parts[0]);
  const curMonth = Number(parts[1]); // 1-based
  return year === curYear && monthIndex + 1 === curMonth;
}

/**
 * True si el mes real en curso cae dentro de [startYm, endYm] (ambos "YYYY-MM",
 * comparación lexicográfica — válida porque el formato es de ancho fijo).
 * Se usa para anclajes que no son "un mes de una serie" sino un rango (ej. el
 * período de un plan de cuotas): `temporalScope: "current"` marca el plan si
 * está activo en el mes real de hoy.
 */
export function isRealCurrentMonthWithinRange(startYm: string, endYm: string): boolean {
  const current = getCurrentMonth();
  return startYm <= current && current <= endYm;
}

// ─── income-expense (dashboard widget efímero + card de /reportes) ────────────

export interface IncomeExpenseMarks {
  /** Una marca por mes (0=ene..11=dic) para reporte.ie.gastoMes. */
  expense: (EvaluatedLimitMark | null)[];
  /** Una marca por mes (0=ene..11=dic) para reporte.ie.ingresoMes. */
  income: (EvaluatedLimitMark | null)[];
}

export function computeIncomeExpenseMarks(
  limits: LimitConfig[],
  year: number,
  monthsExpenseCents: number[],
  monthsIncomeCents: number[],
): IncomeExpenseMarks {
  const expense = monthsExpenseCents.map((cents, i) =>
    evaluateLimits({
      limits,
      anchorKey: "reporte.ie.gastoMes",
      value: cents / 100,
      isCurrentMonth: isRealCurrentMonth(year, i),
    }),
  );
  const income = monthsIncomeCents.map((cents, i) =>
    evaluateLimits({
      limits,
      anchorKey: "reporte.ie.ingresoMes",
      value: cents / 100,
      isCurrentMonth: isRealCurrentMonth(year, i),
    }),
  );
  return { expense, income };
}

// ─── by-category (banda apilada, modo Barra/Línea + cartucho del eje X) ───────
//
// P2 — "Marcas de límite en by-category — el cartucho de mes" (docs/design.md):
// `reporte.cat.gastoMesTotal` no tiene elemento pintado propio (no es ninguna
// banda) — su portador es SIEMPRE el cartucho del mes en el eje X, evaluado acá
// como el arranque de `cartouche`. `reporte.cat.gastoMesCategoria` conserva su
// portador natural (la banda de esa categoría, ese mes) SOLO cuando la banda
// existe (aporte > 0); si el límite cruza en un mes sin aporte (`<`/`≤`/`=`), la
// banda no existe para dibujar el `ring` — la marca "escala" al cartucho (se
// funde con la regla de desempate vigente, `mergeLimitMarks`) en vez de perderse.

export interface ByCategoryMarks {
  /**
   * categoryId → una marca por mes para `reporte.cat.gastoMesCategoria`, SOLO
   * en los meses donde la banda de esa categoría existe (aporte > 0). En un mes
   * sin aporte la entrada es `null` aunque el límite haya cruzado — la marca ya
   * vive en `cartouche` (rescate, ver arriba).
   */
  perCategory: Map<string, (EvaluatedLimitMark | null)[]>;
  /**
   * Una marca por mes para el cartucho del carril del eje X: fusión (más fuerte
   * gana, `mergeLimitMarks`) de `reporte.cat.gastoMesTotal` (siempre evaluado
   * acá, nunca en una banda) + toda marca de `reporte.cat.gastoMesCategoria`
   * rescatada ese mes.
   */
  cartouche: (EvaluatedLimitMark | null)[];
}

export function computeByCategoryMarks(
  limits: LimitConfig[],
  year: number,
  categories: { categoryId: string; monthlyExpenseCents: number[] }[],
  monthsExpenseCents: number[],
): ByCategoryMarks {
  // El total NUNCA tiene banda propia — arranca la fusión del cartucho.
  const cartouche: (EvaluatedLimitMark | null)[] = monthsExpenseCents.map((cents, i) =>
    evaluateLimits({
      limits,
      anchorKey: "reporte.cat.gastoMesTotal",
      value: cents / 100,
      isCurrentMonth: isRealCurrentMonth(year, i),
    }),
  );

  const perCategory = new Map<string, (EvaluatedLimitMark | null)[]>();
  for (const cat of categories) {
    const bandMarks = cat.monthlyExpenseCents.map((cents, i) => {
      const mark = evaluateLimits({
        limits,
        anchorKey: "reporte.cat.gastoMesCategoria",
        value: cents / 100,
        refinement: { categoryId: cat.categoryId },
        isCurrentMonth: isRealCurrentMonth(year, i),
      });
      if (!mark) return null;
      if (cents > 0) return mark; // La banda existe: portador natural (ring sobre la celda/vértice).
      // Rescate (docs/design.md §3): sin aporte ese mes no hay banda que marcar —
      // la marca escala al cartucho, fusionada con lo que ya haya ahí.
      cartouche[i] = mergeLimitMarks(cartouche[i] ?? null, mark);
      return null;
    });
    perCategory.set(cat.categoryId, bandMarks);
  }

  return { perCategory, cartouche };
}

// ─── unique-grid (celda diaria + footer de 5 métricas) ────────────────────────

/** Marca de una celda día×mes (reporte.unicos.celda). */
export function computeUniqueCellMark(
  limits: LimitConfig[],
  year: number,
  monthIndex: number,
  totalCents: number,
): EvaluatedLimitMark | null {
  return evaluateLimits({
    limits,
    anchorKey: "reporte.unicos.celda",
    value: totalCents / 100,
    isCurrentMonth: isRealCurrentMonth(year, monthIndex),
  });
}

export interface UniqueFooterMarks {
  total: EvaluatedLimitMark | null;
  dailyAvg: EvaluatedLimitMark | null;
  pctVsPrev: EvaluatedLimitMark | null;
  inflation: EvaluatedLimitMark | null;
  pctVsPrevAdj: EvaluatedLimitMark | null;
}

export interface UniqueFooterMonthInput {
  total: number;
  dailyAvg: number | null;
  pctVsPrev: number | null;
  inflationPct: number | null;
  pctVsPrevAdj: number | null;
}

/** Marcas de las 5 métricas del footer de un mes de la card unique-grid. */
export function computeUniqueFooterMarks(
  limits: LimitConfig[],
  year: number,
  monthIndex: number,
  footer: UniqueFooterMonthInput,
): UniqueFooterMarks {
  const isCurrentMonth = isRealCurrentMonth(year, monthIndex);
  return {
    total: evaluateLimits({
      limits,
      anchorKey: "reporte.unicos.mesTotal",
      value: footer.total / 100,
      isCurrentMonth,
    }),
    dailyAvg:
      footer.dailyAvg === null
        ? null
        : evaluateLimits({
            limits,
            anchorKey: "reporte.unicos.promedioDiario",
            value: footer.dailyAvg / 100,
            isCurrentMonth,
          }),
    pctVsPrev:
      footer.pctVsPrev === null
        ? null
        : evaluateLimits({
            limits,
            anchorKey: "reporte.unicos.pctVsPrev",
            value: footer.pctVsPrev,
            isCurrentMonth,
          }),
    inflation:
      footer.inflationPct === null
        ? null
        : evaluateLimits({
            limits,
            anchorKey: "reporte.unicos.inflacionMes",
            value: footer.inflationPct,
            isCurrentMonth,
          }),
    pctVsPrevAdj:
      footer.pctVsPrevAdj === null
        ? null
        : evaluateLimits({
            limits,
            anchorKey: "reporte.unicos.pctVsPrevAjustado",
            value: footer.pctVsPrevAdj,
            isCurrentMonth,
          }),
  };
}

/** Combina las 5 marcas del footer en una sola (la más fuerte gana) — para el resumen del footer. */
export function mergeUniqueFooterMarks(marks: UniqueFooterMarks): EvaluatedLimitMark | null {
  return [marks.total, marks.dailyAvg, marks.pctVsPrev, marks.inflation, marks.pctVsPrevAdj].reduce<
    EvaluatedLimitMark | null
  >((acc, m) => mergeLimitMarks(acc, m), null);
}

// ─── installment-gantt (barra por plan de cuotas) ─────────────────────────────

export interface InstallmentBarInput {
  amountCents: number;
  totalInstallments: number;
  /** Período REAL del plan (sin recortar al año visible), "YYYY-MM". */
  realStartMonth: string;
  realEndMonth: string;
}

/**
 * Marca de una barra del gantt de Cuotas — combina `reporte.cuotas.montoPorCuota`
 * y `reporte.cuotas.cantidadCuotas` (la más fuerte gana). `temporalScope: "current"`
 * se evalúa contra el período REAL del plan (no contra el año navegado): el plan
 * está "vigente" si el mes real de hoy cae dentro de su rango.
 */
export function computeInstallmentBarMark(
  limits: LimitConfig[],
  bar: InstallmentBarInput,
): EvaluatedLimitMark | null {
  const isCurrentMonth = isRealCurrentMonthWithinRange(bar.realStartMonth, bar.realEndMonth);
  const montoMark = evaluateLimits({
    limits,
    anchorKey: "reporte.cuotas.montoPorCuota",
    value: bar.amountCents / 100,
    isCurrentMonth,
  });
  const cantidadMark = evaluateLimits({
    limits,
    anchorKey: "reporte.cuotas.cantidadCuotas",
    value: bar.totalInstallments,
    isCurrentMonth,
  });
  return mergeLimitMarks(montoMark, cantidadMark);
}

// ─── inflation-income (3 series-point) ────────────────────────────────────────

export interface InflationIncomeMarks {
  inflation: (EvaluatedLimitMark | null)[];
  incomeVar: (EvaluatedLimitMark | null)[];
  incomeVarAdj: (EvaluatedLimitMark | null)[];
}

export interface InflationIncomeMonthInput {
  inflationPct: number | null;
  incomePct: number | null;
  incomePctAdj: number | null;
}

export function computeInflationIncomeMarks(
  limits: LimitConfig[],
  year: number,
  months: InflationIncomeMonthInput[],
): InflationIncomeMarks {
  const inflation = months.map((m, i) =>
    m.inflationPct === null
      ? null
      : evaluateLimits({
          limits,
          anchorKey: "reporte.infl.inflacionMes",
          value: m.inflationPct,
          isCurrentMonth: isRealCurrentMonth(year, i),
        }),
  );
  const incomeVar = months.map((m, i) =>
    m.incomePct === null
      ? null
      : evaluateLimits({
          limits,
          anchorKey: "reporte.infl.ingresoVarMes",
          value: m.incomePct,
          isCurrentMonth: isRealCurrentMonth(year, i),
        }),
  );
  const incomeVarAdj = months.map((m, i) =>
    m.incomePctAdj === null
      ? null
      : evaluateLimits({
          limits,
          anchorKey: "reporte.infl.ingresoVarAjustado",
          value: m.incomePctAdj,
          isCurrentMonth: isRealCurrentMonth(year, i),
        }),
  );
  return { inflation, incomeVar, incomeVarAdj };
}
