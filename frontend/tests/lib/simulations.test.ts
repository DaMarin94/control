/**
 * Tests de los helpers puros de Simulación de categoría (docs/design.md
 * "Simulación de categoría (`/mes`)", RN-028/029).
 */

import { describe, it, expect } from "vitest";
import {
  isMonthWithinSimulationSpan,
  formatMinDataMotive,
  formatSubtotalSimulatedLabel,
  formatTotalsSimulatedLine,
  formatPausedListNote,
  formatHorizonBandNote,
  formatHorizonReach,
  formatSimulationSpan,
  formatEligibilityNote,
  isEligibleCandidate,
  getCandidatesEmptyCause,
  formatCandidatesEmpty,
  formatSimulateCta,
  formatBatchSuccessToast,
  formatBatchPartialToast,
  formatBatchPartialSummary,
} from "@/lib/simulations";
import type { SimulationCandidate } from "@/types/simulation";

describe("isMonthWithinSimulationSpan — pertenencia POR SIMULACIÓN (§0, cambio 1)", () => {
  it("true para el arranque efectivo exacto", () => {
    expect(
      isMonthWithinSimulationSpan("2026-06", { effectiveStartMonth: "2026-06", endMonth: "2026-12" }),
    ).toBe(true);
  });

  it("false para un mes anterior al arranque efectivo", () => {
    expect(
      isMonthWithinSimulationSpan("2026-05", { effectiveStartMonth: "2026-06", endMonth: "2026-12" }),
    ).toBe(false);
  });

  it("true para un mes dentro del tramo", () => {
    expect(
      isMonthWithinSimulationSpan("2026-08", { effectiveStartMonth: "2026-06", endMonth: "2026-12" }),
    ).toBe(true);
  });

  it("true en el límite exacto del fin del tramo", () => {
    expect(
      isMonthWithinSimulationSpan("2026-12", { effectiveStartMonth: "2026-06", endMonth: "2026-12" }),
    ).toBe(true);
  });

  it("false para un mes más allá del fin del tramo", () => {
    expect(
      isMonthWithinSimulationSpan("2027-01", { effectiveStartMonth: "2026-06", endMonth: "2026-12" }),
    ).toBe(false);
  });

  it("dos simulaciones con tramos distintos: la pertenencia se evalúa una por una", () => {
    const early = { effectiveStartMonth: "2026-06", endMonth: "2026-12" };
    const late = { effectiveStartMonth: "2026-10", endMonth: "2027-03" };
    // Un mes que alcanza a la primera pero no arrancó para la segunda.
    expect(isMonthWithinSimulationSpan("2026-08", early)).toBe(true);
    expect(isMonthWithinSimulationSpan("2026-08", late)).toBe(false);
    // Un mes que ya no alcanza a la primera pero sí a la segunda.
    expect(isMonthWithinSimulationSpan("2027-02", early)).toBe(false);
    expect(isMonthWithinSimulationSpan("2027-02", late)).toBe(true);
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

describe("formatHorizonBandNote — constante, ya no enuncia un tramo (§0, cambio 1)", () => {
  it("declara la regla, sin parámetros", () => {
    expect(formatHorizonBandNote()).toBe("Cada simulación proyecta desde el mes en que la creaste.");
  });
});

describe("formatHorizonReach — declara inicio y fin, con los dos meses nombrados (§3.1)", () => {
  it("nombra el mes de inicio y el de fin", () => {
    expect(formatHorizonReach("2026-10", "2027-03")).toBe("Alcanza desde octubre 2026 hasta marzo 2027.");
  });
});

describe("formatSimulationSpan — tramo por fila de la lista de activas (§4)", () => {
  it("ya arrancó (startMonth <= currentMonth): variante corta con solo el fin", () => {
    expect(formatSimulationSpan("2026-06", "2026-12", "2026-06")).toBe("Proyecta hasta diciembre 2026.");
  });

  it("startMonth ANTERIOR al mes en curso: sigue siendo la variante corta", () => {
    expect(formatSimulationSpan("2026-03", "2026-12", "2026-06")).toBe("Proyecta hasta diciembre 2026.");
  });

  it("todavía no arrancó (startMonth > currentMonth): variante larga con los dos extremos", () => {
    expect(formatSimulationSpan("2026-10", "2027-03", "2026-06")).toBe(
      "Proyecta de octubre 2026 a marzo 2027.",
    );
  });
});

describe("formatEligibilityNote — mensaje único al pie de la lista del selector (§3.1b)", () => {
  it("constante, sin parámetros", () => {
    expect(formatEligibilityNote()).toBe(
      "Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando.",
    );
  });
});

describe("isEligibleCandidate — SOLO simulables (§3)", () => {
  const base: SimulationCandidate = {
    categoryId: "cat-1",
    name: "Suscripciones",
    color: "#3B7DE0",
    monthsWithData: 6,
    alreadySimulated: false,
  };

  it("elegible: ≥3 meses con datos y sin simulación activa", () => {
    expect(isEligibleCandidate(base)).toBe(true);
  });

  it("no elegible: menos de 3 meses con datos", () => {
    expect(isEligibleCandidate({ ...base, monthsWithData: 2 })).toBe(false);
  });

  it("no elegible: ya simulada", () => {
    expect(isEligibleCandidate({ ...base, alreadySimulated: true })).toBe(false);
  });
});

describe("getCandidatesEmptyCause — las cuatro causas del vacío (§3.8)", () => {
  it("null si hay al menos una elegible", () => {
    expect(
      getCandidatesEmptyCause([
        { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 5, alreadySimulated: false },
      ]),
    ).toBeNull();
  });

  it("'no-active-categories': catálogo vacío", () => {
    expect(getCandidatesEmptyCause([])).toBe("no-active-categories");
  });

  it("'no-eligible-data': ninguna llega a 3 meses (aunque ninguna esté simulada)", () => {
    expect(
      getCandidatesEmptyCause([
        { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 0, alreadySimulated: false },
        { categoryId: "cat-2", name: "B", color: "#000", monthsWithData: 2, alreadySimulated: false },
      ]),
    ).toBe("no-eligible-data");
  });

  it("'all-simulated': todas llegan a 3 meses pero ya están simuladas", () => {
    expect(
      getCandidatesEmptyCause([
        { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 6, alreadySimulated: true },
        { categoryId: "cat-2", name: "B", color: "#000", monthsWithData: 8, alreadySimulated: true },
      ]),
    ).toBe("all-simulated");
  });

  it("'mixed': unas sin datos, el resto ya simuladas", () => {
    expect(
      getCandidatesEmptyCause([
        { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 1, alreadySimulated: false },
        { categoryId: "cat-2", name: "B", color: "#000", monthsWithData: 6, alreadySimulated: true },
      ]),
    ).toBe("mixed");
  });
});

describe("formatCandidatesEmpty — los cuatro copys, sin concatenar fragmentos", () => {
  it("no-active-categories: una sola línea", () => {
    expect(formatCandidatesEmpty("no-active-categories")).toEqual({
      line1: "No tenés categorías activas.",
      line2: null,
    });
  });

  it("no-eligible-data", () => {
    expect(formatCandidatesEmpty("no-eligible-data")).toEqual({
      line1: "Ninguna categoría llega a 3 meses con datos.",
      line2: "Cuando alguna los acumule, va a aparecer acá.",
    });
  });

  it("all-simulated", () => {
    expect(formatCandidatesEmpty("all-simulated")).toEqual({
      line1: "Ya estás simulando todas las categorías que se pueden simular.",
      line2: "Podés verlas y eliminarlas en el filtro de Únicos.",
    });
  });

  it("mixed", () => {
    expect(formatCandidatesEmpty("mixed")).toEqual({
      line1: "No queda ninguna categoría para simular.",
      line2: "Las que tienen 3 o más meses de datos ya las estás simulando; al resto todavía le faltan meses.",
    });
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
