/**
 * Tests de los helpers puros de Simulación de categoría (docs/design.md
 * "Simulación de categoría (`/mes`)", RN-028/029).
 */

import { describe, it, expect } from "vitest";
import {
  isFutureMonthWithinHorizon,
  formatMinDataMotive,
  formatSubtotalSimulatedLabel,
  formatTotalsSimulatedLine,
  formatPausedListNote,
  formatHorizonBandNote,
  formatHorizonReach,
} from "@/lib/simulations";

describe("isFutureMonthWithinHorizon", () => {
  it("false para el mes en curso (nunca se simula, RN-028)", () => {
    expect(isFutureMonthWithinHorizon("2026-06", "2026-06", "2026-12")).toBe(false);
  });

  it("false para un mes pasado", () => {
    expect(isFutureMonthWithinHorizon("2026-05", "2026-06", "2026-12")).toBe(false);
  });

  it("true para un mes futuro dentro del horizonte", () => {
    expect(isFutureMonthWithinHorizon("2026-08", "2026-06", "2026-12")).toBe(true);
  });

  it("true en el límite exacto del horizonte (mes == horizonEndMonth)", () => {
    expect(isFutureMonthWithinHorizon("2026-12", "2026-06", "2026-12")).toBe(true);
  });

  it("false para un mes futuro MÁS ALLÁ del horizonte", () => {
    expect(isFutureMonthWithinHorizon("2027-01", "2026-06", "2026-12")).toBe(false);
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

describe("copy de horizonte", () => {
  it("formatHorizonBandNote — 'Se proyecta hasta {mes} {año}.'", () => {
    expect(formatHorizonBandNote("2026-12")).toBe("Se proyecta hasta diciembre 2026.");
  });

  it("formatHorizonReach — 'Alcanza hasta {mes} {año}.'", () => {
    expect(formatHorizonReach("2026-12")).toBe("Alcanza hasta diciembre 2026.");
  });
});
