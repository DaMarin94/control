/**
 * Tests de integración: marca visual pasiva de límites en la card income-expense
 * y en la card by-category de /reportes (P2 — Fase 1, Tramo 2).
 *
 * Recharts está mockeado en report-card.test.tsx (Area/Bar/Tooltip se vuelven
 * no-ops), así que la función de render del `dot`/`content` custom nunca se
 * ejecuta ahí. Estos tests ejercitan directamente las piezas exportadas
 * (`Form1Tooltip`, `Form2Tooltip`, `renderSeriesPointMark`) — funciones puras o
 * componentes chicos sin dependencia de Recharts en sí — para verificar la
 * lógica de marcado sin tener que resolver el layout real de Recharts en jsdom.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LimitConfig } from "@/types/limit";
import type { EvaluatedLimitMark } from "@/lib/limits/evaluate";
import type { ByCategoryMarks } from "@/lib/limits/apply-reports";
import { Form1Tooltip, Form2Tooltip } from "@/components/charts/report-card";
import { renderSeriesPointMark } from "@/components/limits/limit-mark";
import { mergeLimitMarks } from "@/lib/limits/evaluate";
import type { ReportsMovementsResponse } from "@/types/reports";

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
    label: "Gasto anual alto",
    ...overrides,
  };
}

function makeMark(overrides: Partial<EvaluatedLimitMark> = {}): EvaluatedLimitMark {
  return { effect: "dot", matched: [makeLimit()], ...overrides };
}

describe("Form1Tooltip — marca visual pasiva (reporte.ie.*)", () => {
  const basePayload = [
    { dataKey: "incomeCents", value: 50000 },
    { dataKey: "expenseCents", value: 20000 },
  ];

  it("sin marcas no muestra ninguna nota de límite", () => {
    render(
      <Form1Tooltip active payload={basePayload} label="Ene" year={2026} currency="ARS" direction="both" />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("con expenseMarks[0] cruzado, muestra la nota de límite (portador de a11y del punto)", () => {
    const expenseMarks = [makeMark({ matched: [makeLimit({ label: "Gasto anual alto" })] }), null];
    render(
      <Form1Tooltip
        active
        payload={basePayload}
        label="Ene"
        year={2026}
        currency="ARS"
        direction="both"
        expenseMarks={expenseMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: gasto anual alto/i)).toBeInTheDocument();
  });

  it("un mes sin marca (index 1) no muestra la nota", () => {
    const expenseMarks = [makeMark(), null];
    render(
      <Form1Tooltip
        active
        payload={basePayload}
        label="Feb"
        year={2026}
        currency="ARS"
        direction="both"
        expenseMarks={expenseMarks}
      />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });
});

describe("Form2Tooltip — marca visual pasiva (reporte.cat.*)", () => {
  const data: ReportsMovementsResponse = {
    year: 2026,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, "0")}`,
      incomeCents: 0,
      expenseCents: 10000,
    })),
    categories: [
      { categoryId: "cat-1", name: "Comida", color: "#E23B3B", monthlyExpenseCents: Array(12).fill(10000) },
    ],
    availableCategories: [{ categoryId: "cat-1", name: "Comida", color: "#E23B3B", hasExpense: true, hasIncome: false }],
    earliestYear: 2025,
  };

  // Form2Tooltip consume mergedCategories (RF-REP-017) en vez de data.categories directo.
  // Sin toggle de simulados, es la misma info que data.categories con la capa simulada
  // en null (sin aporte) — ver report-card.tsx, buildMergedCategories.
  const mergedCategories = data.categories.map((cat) => ({
    ...cat,
    simulatedMonthlyExpenseCents: Array<number | null>(12).fill(null),
  }));

  it("sin marcas no muestra ninguna nota de límite", () => {
    render(
      <Form2Tooltip
        active
        payload={[{ dataKey: "cat-1", value: 10000 }]}
        label="Ene"
        data={data}
        year={2026}
        currency="ARS"
        mergedCategories={mergedCategories}
        includeSimulated={false}
      />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("con la categoría marcada en el mes hovereado, muestra la nota combinada", () => {
    const categoryMarks: ByCategoryMarks = {
      perCategory: new Map([["cat-1", [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesCategoria", label: "Comida cara" })] }), null]]]),
      total: [null, null],
    };
    render(
      <Form2Tooltip
        active
        payload={[{ dataKey: "cat-1", value: 10000 }]}
        label="Ene"
        data={data}
        year={2026}
        currency="ARS"
        mergedCategories={mergedCategories}
        includeSimulated={false}
        categoryMarks={categoryMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: comida cara/i)).toBeInTheDocument();
  });

  it("con el total del mes marcado, muestra la nota", () => {
    const categoryMarks: ByCategoryMarks = {
      perCategory: new Map([["cat-1", [null, null]]]),
      total: [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", label: "Total mensual alto" })] }), null],
    };
    render(
      <Form2Tooltip
        active
        payload={[{ dataKey: "cat-1", value: 10000 }]}
        label="Ene"
        data={data}
        year={2026}
        currency="ARS"
        mergedCategories={mergedCategories}
        includeSimulated={false}
        categoryMarks={categoryMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: total mensual alto/i)).toBeInTheDocument();
  });
});

describe("renderSeriesPointMark — marcador de punto de serie (P2 — Tramo 2)", () => {
  it("sin marca devuelve un <g/> vacío (cero impacto)", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, [null]);
    expect(el.type).toBe("g");
  });

  it("con marca 'dot' devuelve un círculo relleno ámbar", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, [makeMark({ effect: "dot" })]);
    const props = el.props as { fill?: string; stroke?: string };
    expect(el.type).toBe("circle");
    expect(props.fill).toBe("var(--warning)");
  });

  it("con marca 'ring' devuelve un círculo sin relleno con stroke ámbar", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, [makeMark({ effect: "ring" })]);
    const props = el.props as { fill?: string; stroke?: string };
    expect(el.type).toBe("circle");
    expect(props.fill).toBe("none");
    expect(props.stroke).toBe("var(--warning)");
  });

  it("sin marks (undefined) devuelve un <g/> vacío", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, undefined);
    expect(el.type).toBe("g");
  });
});

describe("FormBChartInner (vista Línea de by-category) — dot por serie de categoría (P2 — Tramo 2)", () => {
  // Reproduce el merge que hace FormBChartInner por cada Area de categoría:
  // mergeLimitMarks(catMonthMarks[i], isTop ? total[i] : null) — misma lógica
  // (y misma colisión "la más fuerte gana") que la banda de la vista Barra.
  function computeDotMarks(
    catMonthMarks: (EvaluatedLimitMark | null)[],
    totalMarks: (EvaluatedLimitMark | null)[],
    isTop: boolean,
  ): (EvaluatedLimitMark | null)[] {
    return catMonthMarks.map((m, i) => mergeLimitMarks(m, isTop ? (totalMarks[i] ?? null) : null));
  }

  it("categoría no-top con reporte.cat.gastoMesCategoria cruzado: el punto se marca", () => {
    const catMonthMarks = [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesCategoria", label: "Comida cara" })] }), null];
    const totalMarks: (EvaluatedLimitMark | null)[] = [null, null];
    const dotMarks = computeDotMarks(catMonthMarks, totalMarks, false);
    const marked = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, dotMarks);
    const unmarked = renderSeriesPointMark({ cx: 10, cy: 20, index: 1 }, dotMarks);
    expect(marked.type).toBe("circle");
    expect(unmarked.type).toBe("g");
  });

  it("serie top (última categoría del stack) también se marca por reporte.cat.gastoMesTotal", () => {
    const catMonthMarks: (EvaluatedLimitMark | null)[] = [null, null];
    const totalMarks = [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", label: "Total mensual alto" })] }), null];
    const dotMarks = computeDotMarks(catMonthMarks, totalMarks, true);
    const marked = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, dotMarks);
    expect(marked.type).toBe("circle");
  });

  it("serie no-top IGNORA el total del mes (solo la serie top del stack lo hereda)", () => {
    const catMonthMarks: (EvaluatedLimitMark | null)[] = [null, null];
    const totalMarks = [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", label: "Total mensual alto" })] }), null];
    const dotMarks = computeDotMarks(catMonthMarks, totalMarks, false);
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, dotMarks);
    expect(el.type).toBe("g");
  });

  it("cero-impacto: sin límites (categoryMarks undefined) ningún punto se marca", () => {
    const dotMarks = Array<EvaluatedLimitMark | null>(12).fill(null);
    for (let i = 0; i < 12; i++) {
      expect(renderSeriesPointMark({ cx: 10, cy: 20, index: i }, dotMarks).type).toBe("g");
    }
  });
});
