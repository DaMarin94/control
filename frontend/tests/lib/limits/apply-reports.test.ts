/**
 * Tests del cableado de límites en dashboard + reportes (P2 — Fase 1, Tramo 2).
 * Espeja el patrón de apply-month.test.ts: funciones puras, sin React/DOM.
 */

import { describe, it, expect, vi } from "vitest";
import type { LimitConfig } from "@/types/limit";

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, getCurrentMonth: vi.fn(() => "2026-06") };
});

import {
  isRealCurrentMonth,
  isRealCurrentMonthWithinRange,
  computeIncomeExpenseMarks,
  computeByCategoryMarks,
  computeUniqueCellMark,
  computeUniqueFooterMarks,
  mergeUniqueFooterMarks,
  computeInstallmentBarMark,
  computeInflationIncomeMarks,
} from "@/lib/limits/apply-reports";

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: overrides.id ?? "limit-1",
    enabled: true,
    anchorKey: "reporte.ie.gastoMes",
    temporalScope: "all",
    operator: "gt",
    threshold: 100,
    nature: "passive",
    effect: "dot",
    ...overrides,
  };
}

describe("isRealCurrentMonth", () => {
  it("true cuando year+monthIndex coinciden con el mes real (mockeado a 2026-06)", () => {
    expect(isRealCurrentMonth(2026, 5)).toBe(true); // monthIndex 5 = junio (0-based)
  });

  it("false para otro mes del mismo año", () => {
    expect(isRealCurrentMonth(2026, 4)).toBe(false);
  });

  it("false para otro año", () => {
    expect(isRealCurrentMonth(2025, 5)).toBe(false);
  });
});

describe("isRealCurrentMonthWithinRange", () => {
  it("true cuando el mes real cae dentro del rango", () => {
    expect(isRealCurrentMonthWithinRange("2026-01", "2026-12")).toBe(true);
  });

  it("true en los bordes inclusive", () => {
    expect(isRealCurrentMonthWithinRange("2026-06", "2026-06")).toBe(true);
  });

  it("false cuando el mes real es anterior al rango", () => {
    expect(isRealCurrentMonthWithinRange("2026-07", "2026-12")).toBe(false);
  });

  it("false cuando el mes real es posterior al rango", () => {
    expect(isRealCurrentMonthWithinRange("2025-01", "2026-05")).toBe(false);
  });
});

describe("computeIncomeExpenseMarks", () => {
  it("marca solo los meses que cruzan reporte.ie.gastoMes / .ingresoMes", () => {
    const limits = [
      makeLimit({ anchorKey: "reporte.ie.gastoMes", threshold: 500, effect: "dot" }),
      makeLimit({ id: "l2", anchorKey: "reporte.ie.ingresoMes", threshold: 1000, effect: "ring" }),
    ];
    const expenseCents = [10000, 60000]; // $100, $600
    const incomeCents = [50000, 150000]; // $500, $1500
    const { expense, income } = computeIncomeExpenseMarks(limits, 2026, expenseCents, incomeCents);
    expect(expense[0]).toBeNull();
    expect(expense[1]?.effect).toBe("dot");
    expect(income[0]).toBeNull();
    expect(income[1]?.effect).toBe("ring");
  });

  it("sin límites devuelve todo null (cero impacto)", () => {
    const { expense, income } = computeIncomeExpenseMarks([], 2026, [10000], [10000]);
    expect(expense).toEqual([null]);
    expect(income).toEqual([null]);
  });
});

describe("computeByCategoryMarks", () => {
  it("marca la categoría cuando su gasto mensual cruza reporte.cat.gastoMesCategoria", () => {
    const limits = [
      makeLimit({
        anchorKey: "reporte.cat.gastoMesCategoria",
        threshold: 200,
        refinement: { categoryId: "cat-1" },
        effect: "glyph",
      }),
    ];
    const categories = [
      { categoryId: "cat-1", monthlyExpenseCents: [10000, 30000] }, // $100, $300
      { categoryId: "cat-2", monthlyExpenseCents: [50000, 50000] },
    ];
    const { perCategory } = computeByCategoryMarks(limits, 2026, categories, [60000, 80000]);
    expect(perCategory.get("cat-1")?.[0]).toBeNull();
    expect(perCategory.get("cat-1")?.[1]?.effect).toBe("glyph");
    expect(perCategory.get("cat-2")?.every((m) => m === null)).toBe(true);
  });

  it("marca el cartucho del mes cuando cruza reporte.cat.gastoMesTotal", () => {
    const limits = [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", threshold: 500, effect: "ring" })];
    const { cartouche } = computeByCategoryMarks(limits, 2026, [], [10000, 60000]);
    expect(cartouche[0]).toBeNull();
    expect(cartouche[1]?.effect).toBe("ring");
  });

  it("caso testigo del defecto: el total marca el cartucho aunque TODAS las categorías estén en 0 ese mes", () => {
    // La categoría más chica del stack (o, acá, todas) no aporta nada ese mes:
    // el total sigue viniendo del ancho del mes (monthsExpenseCents), no de las
    // bandas — el cartucho no depende de que exista ningún elemento pintado.
    const limits = [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", threshold: 500, effect: "glyph" })];
    const categories = [
      { categoryId: "cat-chica", monthlyExpenseCents: [0, 0] },
      { categoryId: "cat-grande", monthlyExpenseCents: [0, 0] },
    ];
    const { cartouche } = computeByCategoryMarks(limits, 2026, categories, [10000, 60000]);
    expect(cartouche[1]?.effect).toBe("glyph");
  });

  it("rescate: una marca de gastoMesCategoria sin banda ese mes (aporte 0) escala al cartucho", () => {
    const limits = [
      makeLimit({
        anchorKey: "reporte.cat.gastoMesCategoria",
        threshold: 50,
        operator: "lt",
        refinement: { categoryId: "cat-1" },
        effect: "ring",
      }),
    ];
    const categories = [{ categoryId: "cat-1", monthlyExpenseCents: [0, 30000] }]; // $0, $300
    const { perCategory, cartouche } = computeByCategoryMarks(limits, 2026, categories, [0, 30000]);
    // Sin banda (aporte 0, mes 0): la marca NO vive en perCategory...
    expect(perCategory.get("cat-1")?.[0]).toBeNull();
    // ...escala al cartucho.
    expect(cartouche[0]?.effect).toBe("ring");
    // Mes 1: SÍ hay banda (aporte > 0, $300 no cruza < $50) — ni banda ni cartucho.
    expect(perCategory.get("cat-1")?.[1]).toBeNull();
    expect(cartouche[1]).toBeNull();
  });

  it("fusión: el total y una categoría rescatada en el mismo mes producen UN cartucho con la marca más fuerte", () => {
    const limits = [
      makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", threshold: 500, effect: "glyph" }),
      makeLimit({
        id: "l2",
        anchorKey: "reporte.cat.gastoMesCategoria",
        threshold: 50,
        operator: "lt",
        refinement: { categoryId: "cat-1" },
        effect: "ring",
      }),
    ];
    const categories = [{ categoryId: "cat-1", monthlyExpenseCents: [0] }];
    const { cartouche } = computeByCategoryMarks(limits, 2026, categories, [60000]); // $600 > $500
    // ring (7) > glyph (3): gana la banda rescatada, y matched enumera las dos.
    expect(cartouche[0]?.effect).toBe("ring");
    expect(cartouche[0]?.matched).toHaveLength(2);
  });
});

describe("computeUniqueCellMark", () => {
  it("no marca cuando el valor no cruza", () => {
    const limits = [makeLimit({ anchorKey: "reporte.unicos.celda", threshold: 1000, effect: "ring" })];
    expect(computeUniqueCellMark(limits, 2026, 5, 5000)).toBeNull(); // $50
  });

  it("marca cuando el valor cruza", () => {
    const limits = [makeLimit({ anchorKey: "reporte.unicos.celda", threshold: 10, effect: "dot" })];
    expect(computeUniqueCellMark(limits, 2026, 5, 5000)?.effect).toBe("dot"); // $50 > 10
  });
});

describe("computeUniqueFooterMarks", () => {
  const footer = { total: 500000, dailyAvg: 20000, pctVsPrev: 15, inflationPct: 5, pctVsPrevAdj: 10 };

  it("evalúa las 5 métricas contra sus keys respectivas", () => {
    const limits = [
      makeLimit({ anchorKey: "reporte.unicos.mesTotal", threshold: 1000, effect: "tint" }),
      makeLimit({ id: "l2", anchorKey: "reporte.unicos.promedioDiario", threshold: 100, effect: "bold" }),
      makeLimit({ id: "l3", anchorKey: "reporte.unicos.pctVsPrev", threshold: 10, effect: "glyph" }),
      makeLimit({ id: "l4", anchorKey: "reporte.unicos.inflacionMes", threshold: 3, effect: "tint" }),
      makeLimit({ id: "l5", anchorKey: "reporte.unicos.pctVsPrevAjustado", threshold: 8, effect: "bold" }),
    ];
    const marks = computeUniqueFooterMarks(limits, 2026, 5, footer);
    expect(marks.total?.effect).toBe("tint");
    expect(marks.dailyAvg?.effect).toBe("bold");
    expect(marks.pctVsPrev?.effect).toBe("glyph");
    expect(marks.inflation?.effect).toBe("tint");
    expect(marks.pctVsPrevAdj?.effect).toBe("bold");
  });

  it("valores null del footer (mes futuro) nunca cruzan (no evalúa contra null)", () => {
    const limits = [makeLimit({ anchorKey: "reporte.unicos.promedioDiario", threshold: 0, effect: "bold" })];
    const nullFooter = { total: 0, dailyAvg: null, pctVsPrev: null, inflationPct: null, pctVsPrevAdj: null };
    const marks = computeUniqueFooterMarks(limits, 2026, 5, nullFooter);
    expect(marks.dailyAvg).toBeNull();
    expect(marks.pctVsPrev).toBeNull();
    expect(marks.inflation).toBeNull();
    expect(marks.pctVsPrevAdj).toBeNull();
  });

  it("mergeUniqueFooterMarks combina todas — la más fuerte gana", () => {
    const limits = [
      makeLimit({ anchorKey: "reporte.unicos.mesTotal", threshold: 1000, effect: "tint" }),
      makeLimit({ id: "l2", anchorKey: "reporte.unicos.promedioDiario", threshold: 100, effect: "bold" }),
    ];
    const marks = computeUniqueFooterMarks(limits, 2026, 5, footer);
    const merged = mergeUniqueFooterMarks(marks);
    expect(merged?.effect).toBe("tint"); // tint(2) > bold(1) en la escala de fuerza
  });

  it("mergeUniqueFooterMarks devuelve null si ninguna métrica cruzó", () => {
    const marks = computeUniqueFooterMarks([], 2026, 5, footer);
    expect(mergeUniqueFooterMarks(marks)).toBeNull();
  });
});

describe("computeInstallmentBarMark", () => {
  it("combina montoPorCuota y cantidadCuotas — la más fuerte gana", () => {
    const limits = [
      makeLimit({ anchorKey: "reporte.cuotas.montoPorCuota", threshold: 1000, effect: "glyph" }),
      makeLimit({ id: "l2", anchorKey: "reporte.cuotas.cantidadCuotas", threshold: 5, effect: "ring" }),
    ];
    const bar = { amountCents: 200000, totalInstallments: 12, realStartMonth: "2026-01", realEndMonth: "2026-12" };
    const mark = computeInstallmentBarMark(limits, bar);
    expect(mark?.effect).toBe("ring"); // ring(7) > glyph(3)
    expect(mark?.matched).toHaveLength(2);
  });

  it("temporalScope 'current' solo marca si el mes real cae dentro del período REAL del plan", () => {
    const limits = [
      makeLimit({
        anchorKey: "reporte.cuotas.montoPorCuota",
        threshold: 100,
        effect: "glyph",
        temporalScope: "current",
      }),
    ];
    const activeBar = { amountCents: 200000, totalInstallments: 3, realStartMonth: "2026-05", realEndMonth: "2026-07" };
    const pastBar = { amountCents: 200000, totalInstallments: 3, realStartMonth: "2025-01", realEndMonth: "2025-12" };
    expect(computeInstallmentBarMark(limits, activeBar)).not.toBeNull();
    expect(computeInstallmentBarMark(limits, pastBar)).toBeNull();
  });

  it("null si ningún límite cruza", () => {
    const limits = [makeLimit({ anchorKey: "reporte.cuotas.montoPorCuota", threshold: 999999999 })];
    const bar = { amountCents: 200000, totalInstallments: 12, realStartMonth: "2026-01", realEndMonth: "2026-12" };
    expect(computeInstallmentBarMark(limits, bar)).toBeNull();
  });
});

describe("computeInflationIncomeMarks", () => {
  it("evalúa las 3 series contra sus keys, respetando null (mes futuro)", () => {
    const limits = [
      makeLimit({ anchorKey: "reporte.infl.inflacionMes", threshold: 3, effect: "dot" }),
      makeLimit({ id: "l2", anchorKey: "reporte.infl.ingresoVarMes", threshold: 10, effect: "ring" }),
      makeLimit({ id: "l3", anchorKey: "reporte.infl.ingresoVarAjustado", threshold: 5, effect: "dot" }),
    ];
    const months = [
      { inflationPct: 5, incomePct: 15, incomePctAdj: 8 },
      { inflationPct: null, incomePct: null, incomePctAdj: null }, // mes futuro
    ];
    const { inflation, incomeVar, incomeVarAdj } = computeInflationIncomeMarks(limits, 2026, months);
    expect(inflation[0]?.effect).toBe("dot");
    expect(incomeVar[0]?.effect).toBe("ring");
    expect(incomeVarAdj[0]?.effect).toBe("dot");
    expect(inflation[1]).toBeNull();
    expect(incomeVar[1]).toBeNull();
    expect(incomeVarAdj[1]).toBeNull();
  });

  it("sin límites devuelve todo null (cero impacto)", () => {
    const months = [{ inflationPct: 5, incomePct: 15, incomePctAdj: 8 }];
    const { inflation, incomeVar, incomeVarAdj } = computeInflationIncomeMarks([], 2026, months);
    expect(inflation).toEqual([null]);
    expect(incomeVar).toEqual([null]);
    expect(incomeVarAdj).toEqual([null]);
  });
});
