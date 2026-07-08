/**
 * Tests de integración: marca visual pasiva de límites en la card
 * inflation-income (P2 — Fase 1, Tramo 2). reporte.infl.inflacionMes /
 * .ingresoVarMes / .ingresoVarAjustado (series-point: dot/ring).
 *
 * Recharts está mockeado en inflation-income-card.test.tsx (Line/Tooltip se
 * vuelven no-ops), así que el `dot`/`content` custom nunca se ejecuta ahí.
 * Este test ejercita directamente `CustomTooltip` (exportado) — mismo patrón
 * que report-card-limits.test.tsx — para verificar la lógica de marcado sin
 * resolver el layout real de Recharts en jsdom.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LimitConfig } from "@/types/limit";
import type { EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { CustomTooltip } from "@/components/charts/inflation-income-card";

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: overrides.id ?? "limit-1",
    enabled: true,
    anchorKey: "reporte.infl.inflacionMes",
    temporalScope: "all",
    operator: "gt",
    threshold: 3,
    nature: "passive",
    effect: "dot",
    label: "Inflación alta",
    ...overrides,
  };
}

function makeMark(overrides: Partial<EvaluatedLimitMark> = {}): EvaluatedLimitMark {
  return { effect: "dot", matched: [makeLimit()], ...overrides };
}

describe("CustomTooltip (inflation-income) — marca visual pasiva (reporte.infl.*)", () => {
  const basePayload = [
    { name: "inflation", value: 5 },
    { name: "income", value: 8 },
    { name: "incomeAdj", value: 3 },
  ];

  it("sin marcas no muestra ninguna nota de límite", () => {
    render(<CustomTooltip active payload={basePayload} label="Ene" hiddenSeries={[]} year={2026} />);
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("con inflationMarks[0] cruzado, muestra la nota de límite", () => {
    const inflationMarks = [makeMark({ matched: [makeLimit({ label: "Inflación alta" })] }), null];
    render(
      <CustomTooltip
        active
        payload={basePayload}
        label="Ene"
        hiddenSeries={[]}
        year={2026}
        inflationMarks={inflationMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: inflación alta/i)).toBeInTheDocument();
  });

  it("con incomeVarMarks[0] cruzado, muestra la nota de límite", () => {
    const incomeVarMarks = [
      makeMark({ matched: [makeLimit({ anchorKey: "reporte.infl.ingresoVarMes", label: "Ingreso nominal alto" })] }),
      null,
    ];
    render(
      <CustomTooltip
        active
        payload={basePayload}
        label="Ene"
        hiddenSeries={[]}
        year={2026}
        incomeVarMarks={incomeVarMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: ingreso nominal alto/i)).toBeInTheDocument();
  });

  it("con incomeVarAdjMarks[0] cruzado, muestra la nota de límite", () => {
    const incomeVarAdjMarks = [
      makeMark({ matched: [makeLimit({ anchorKey: "reporte.infl.ingresoVarAjustado", label: "Ingreso ajustado alto" })] }),
      null,
    ];
    render(
      <CustomTooltip
        active
        payload={basePayload}
        label="Ene"
        hiddenSeries={[]}
        year={2026}
        incomeVarAdjMarks={incomeVarAdjMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: ingreso ajustado alto/i)).toBeInTheDocument();
  });

  it("un mes sin marca (index 1) no muestra la nota", () => {
    const inflationMarks = [makeMark(), null];
    render(
      <CustomTooltip
        active
        payload={basePayload}
        label="Feb"
        hiddenSeries={[]}
        year={2026}
        inflationMarks={inflationMarks}
      />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });
});
