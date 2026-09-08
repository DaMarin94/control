/**
 * Tests de los helpers puros de Simulación de categoría (docs/design.md
 * "Simulación de categoría (`/mes`)", RN-028/029).
 */

import { describe, it, expect } from "vitest";
import {
  isMonthWithinHorizon,
  formatMinDataMotive,
  formatSubtotalSimulatedLabel,
  formatTotalsSimulatedLine,
  formatPausedListNote,
  formatHorizonBandNote,
  formatHorizonReach,
  formatSimulateCta,
  formatBatchSuccessToast,
  formatBatchPartialToast,
  formatBatchPartialSummary,
} from "@/lib/simulations";

describe("isMonthWithinHorizon", () => {
  it("true para el MES EN CURSO (el horizonte arranca ahí, RN-028)", () => {
    expect(isMonthWithinHorizon("2026-06", "2026-06", "2026-12")).toBe(true);
  });

  it("false para un mes pasado", () => {
    expect(isMonthWithinHorizon("2026-05", "2026-06", "2026-12")).toBe(false);
  });

  it("true para un mes futuro dentro del horizonte", () => {
    expect(isMonthWithinHorizon("2026-08", "2026-06", "2026-12")).toBe(true);
  });

  it("true en el límite exacto del horizonte (mes == horizonEndMonth)", () => {
    expect(isMonthWithinHorizon("2026-12", "2026-06", "2026-12")).toBe(true);
  });

  it("false para un mes futuro MÁS ALLÁ del horizonte", () => {
    expect(isMonthWithinHorizon("2027-01", "2026-06", "2026-12")).toBe(false);
  });
});

describe("formatMinDataMotive", () => {
  it("incluye el N de meses con datos", () => {
    expect(formatMinDataMotive(0)).toBe("Necesita 3 meses con datos (tiene 0)");
    expect(formatMinDataMotive(2)).toBe("Necesita 3 meses con datos (tiene 2)");
  });
});

describe("copy sensible al conteo — singular con frase propia, nunca '1 movimientos'", () => {
  it("formatSubtotalSimulatedLabel: singular vs. plural", () => {
    expect(formatSubtotalSimulatedLabel(1)).toBe("El subtotal incluye 1 movimiento simulado");
    expect(formatSubtotalSimulatedLabel(2)).toBe("El subtotal incluye 2 movimientos simulados");
  });

  it("formatTotalsSimulatedLine: singular vs. plural", () => {
    expect(formatTotalsSimulatedLine(1)).toBe("Los totales incluyen 1 movimiento simulado.");
    expect(formatTotalsSimulatedLine(3)).toBe("Los totales incluyen 3 movimientos simulados.");
  });

  it("formatPausedListNote: singular vs. plural", () => {
    expect(formatPausedListNote(1)).toBe(
      "Una simulación no está proyectando: le faltan meses con datos.",
    );
    expect(formatPausedListNote(2)).toBe(
      "2 simulaciones no están proyectando: les faltan meses con datos.",
    );
  });
});

describe("copy de horizonte — declara inicio y fin (arranca en el mes en curso)", () => {
  it("formatHorizonBandNote — 'Se proyecta desde este mes hasta {mes} {año}.'", () => {
    expect(formatHorizonBandNote("2026-12")).toBe("Se proyecta desde este mes hasta diciembre 2026.");
  });

  it("formatHorizonReach — 'Alcanza desde este mes hasta {Mes AAAA}.'", () => {
    expect(formatHorizonReach("2026-12")).toBe("Alcanza desde este mes hasta diciembre 2026.");
  });
});

describe("formatSimulateCta — rótulo del botón sensible al conteo (§3.5)", () => {
  it("0 → 'Simular' (sin número)", () => {
    expect(formatSimulateCta(0)).toBe("Simular");
  });

  it("1 → 'Simular 1 categoría' (singular con frase propia)", () => {
    expect(formatSimulateCta(1)).toBe("Simular 1 categoría");
  });

  it("N ≥ 2 → 'Simular {N} categorías'", () => {
    expect(formatSimulateCta(2)).toBe("Simular 2 categorías");
    expect(formatSimulateCta(12)).toBe("Simular 12 categorías");
  });
});

describe("formatBatchSuccessToast — éxito total del batch (§3.7 a)", () => {
  it("1 → 'Simulación creada.' (copy vigente, textual)", () => {
    expect(formatBatchSuccessToast(1)).toBe("Simulación creada.");
  });

  it("N ≥ 2 → '{N} simulaciones creadas.'", () => {
    expect(formatBatchSuccessToast(3)).toBe("3 simulaciones creadas.");
  });
});

describe("formatBatchPartialToast — fallo parcial del batch (§3.7 c)", () => {
  it("K=1 → 'Se creó 1 de {N} simulaciones.'", () => {
    expect(formatBatchPartialToast(1, 3)).toBe("Se creó 1 de 3 simulaciones.");
  });

  it("K>1 → 'Se crearon {K} de {N} simulaciones.'", () => {
    expect(formatBatchPartialToast(2, 3)).toBe("Se crearon 2 de 3 simulaciones.");
  });
});

describe("formatBatchPartialSummary — caja de resumen neutra del fallo parcial (§3.7 c)", () => {
  it("K=1", () => {
    expect(formatBatchPartialSummary(1, 3)).toBe(
      "Se creó 1 de 3. Las que siguen tildadas no se pudieron crear — el motivo está en cada fila.",
    );
  });

  it("K>1", () => {
    expect(formatBatchPartialSummary(2, 3)).toBe(
      "Se crearon 2 de 3. Las que siguen tildadas no se pudieron crear — el motivo está en cada fila.",
    );
  });
});
