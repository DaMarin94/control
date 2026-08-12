/**
 * Tests de la aritmética RN-016 replicada en el cliente para el modal de
 * alcance de la anulación de un fijo (RF-MF-005, `docs/design.md`
 * §"Modal de alcance de la anulación de un fijo").
 *
 * Fijo de referencia usado en varios casos (mismo del checklist visual de
 * `docs/design.md`): frecuencia TRIMESTRAL (3), arranque Ene 2025, sin fin.
 */

import { describe, it, expect } from "vitest";
import {
  monthDiff,
  addMonthsToKey,
  isAppearance,
  lastAppearanceBefore,
  monthsBetween,
  MAX_SKIP_RANGE_MONTHS,
  computeChainCeiling,
  buildDesdeOptions,
  buildHastaOptions,
  countAppearances,
} from "@/lib/recurring-skip-range";

// ─── monthDiff / addMonthsToKey ───────────────────────────────────────────────

describe("monthDiff", () => {
  it("0 para el mismo mes", () => {
    expect(monthDiff("2026-06", "2026-06")).toBe(0);
  });

  it("diferencia positiva dentro del mismo año", () => {
    expect(monthDiff("2026-01", "2026-06")).toBe(5);
  });

  it("diferencia negativa (b anterior a a)", () => {
    expect(monthDiff("2026-06", "2026-01")).toBe(-5);
  });

  it("cruza el límite de año", () => {
    expect(monthDiff("2025-11", "2026-02")).toBe(3);
  });
});

describe("addMonthsToKey", () => {
  it("suma meses dentro del mismo año", () => {
    expect(addMonthsToKey("2026-01", 5)).toBe("2026-06");
  });

  it("suma meses cruzando el fin de año", () => {
    expect(addMonthsToKey("2025-11", 3)).toBe("2026-02");
  });

  it("resta meses (n negativo)", () => {
    expect(addMonthsToKey("2026-02", -3)).toBe("2025-11");
  });

  it("n=0 devuelve el mismo mes", () => {
    expect(addMonthsToKey("2026-06", 0)).toBe("2026-06");
  });
});

// ─── isAppearance (RN-016) ─────────────────────────────────────────────────────

describe("isAppearance", () => {
  it("el mes de arranque siempre es aparición", () => {
    expect(isAppearance("2025-01", 3, "2025-01")).toBe(true);
  });

  it("frecuencia 1 (mensual): todos los meses desde el arranque son aparición", () => {
    expect(isAppearance("2026-01", 1, "2026-07")).toBe(true);
  });

  it("frecuencia 3 (trimestral): aparece cada 3 meses desde el arranque", () => {
    expect(isAppearance("2025-01", 3, "2025-04")).toBe(true);
    expect(isAppearance("2025-01", 3, "2025-07")).toBe(true);
    expect(isAppearance("2025-01", 3, "2026-01")).toBe(true);
  });

  it("frecuencia 3: un mes que no cae en el múltiplo NO es aparición", () => {
    expect(isAppearance("2025-01", 3, "2025-02")).toBe(false);
    expect(isAppearance("2025-01", 3, "2025-03")).toBe(false);
    expect(isAppearance("2025-01", 3, "2025-05")).toBe(false);
  });

  it("false para cualquier mes anterior al arranque", () => {
    expect(isAppearance("2025-01", 3, "2024-12")).toBe(false);
    expect(isAppearance("2025-01", 3, "2024-10")).toBe(false);
  });

  it("frecuencia 5 (no divisor común de 12): apariciones no anuales", () => {
    expect(isAppearance("2026-01", 5, "2026-06")).toBe(true);
    expect(isAppearance("2026-01", 5, "2026-11")).toBe(true);
    expect(isAppearance("2026-01", 5, "2026-07")).toBe(false);
  });
});

// ─── lastAppearanceBefore ──────────────────────────────────────────────────────

describe("lastAppearanceBefore", () => {
  it("con techo exacto en una aparición, devuelve el mes anterior a esa aparición", () => {
    // Trimestral Ene 2025: apariciones ene, abr, jul, oct... endMonth exclusivo = jul 2025
    // → última aparición antes de jul 2025 es abr 2025.
    expect(lastAppearanceBefore("2025-01", 3, "2025-07")).toBe("2025-04");
  });

  it("con techo que NO cae en una aparición, retrocede a la aparición real más cercana", () => {
    // endMonth exclusivo = jun 2025 (no es aparición trimestral) → último real: abr 2025.
    expect(lastAppearanceBefore("2025-01", 3, "2025-06")).toBe("2025-04");
  });

  it("null cuando el techo es igual o anterior al arranque (no hay apariciones)", () => {
    expect(lastAppearanceBefore("2025-01", 3, "2025-01")).toBe(null);
    expect(lastAppearanceBefore("2025-01", 3, "2024-06")).toBe(null);
  });

  it("frecuencia mensual: el mes anterior al techo siempre es la última aparición", () => {
    expect(lastAppearanceBefore("2026-01", 1, "2026-07")).toBe("2026-06");
  });
});

// ─── monthsBetween ──────────────────────────────────────────────────────────────

describe("monthsBetween", () => {
  it("lista contigua inclusive de from a to", () => {
    expect(monthsBetween("2026-01", "2026-04")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
  });

  it("un solo mes cuando from === to", () => {
    expect(monthsBetween("2026-06", "2026-06")).toEqual(["2026-06"]);
  });

  it("cruza el fin de año", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

// ─── computeChainCeiling ────────────────────────────────────────────────────────

describe("computeChainCeiling", () => {
  it("null cuando el fijo es indefinido (sin endMonth)", () => {
    expect(computeChainCeiling("2025-01", 3, null)).toBe(null);
  });

  it("último mes de aparición real cuando hay fin de vigencia", () => {
    expect(computeChainCeiling("2025-01", 3, "2025-07")).toBe("2025-04");
  });
});

// ─── buildDesdeOptions ──────────────────────────────────────────────────────────

describe("buildDesdeOptions", () => {
  it("con fin de vigencia: universo = TODOS los meses del calendario entre arranque y último mes de aparición (no solo apariciones)", () => {
    // Trimestral Ene 2025, fin exclusivo Oct 2025 → última aparición Jul 2025.
    // El selector ofrece cada mes calendario del piso al techo — el filtrado a
    // apariciones reales lo hace `countAppearances` sobre el rango elegido, no
    // el universo del `<select>` (docs/design.md §2.4 "todos los meses...").
    const options = buildDesdeOptions("2025-01", 3, "2025-10", "2025-07");
    expect(options[0]).toBe("2025-01");
    expect(options[options.length - 1]).toBe("2025-07");
    expect(options).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
    ]);
  });

  it("sin fin de vigencia: universo se extiende MAX_SKIP_RANGE_MONTHS - 1 más allá del mes visualizado", () => {
    const options = buildDesdeOptions("2025-01", 3, null, "2026-06");
    expect(options[0]).toBe("2025-01");
    expect(options[options.length - 1]).toBe(addMonthsToKey("2026-06", MAX_SKIP_RANGE_MONTHS - 1));
  });

  it("el catálogo siempre incluye el mes visualizado (default de 'Desde')", () => {
    const options = buildDesdeOptions("2025-01", 3, null, "2026-06");
    expect(options).toContain("2026-06");
  });

  it("checklist docs/design.md: arranque Ene 2025 → primera opción de 'Desde' es Ene 2025", () => {
    const options = buildDesdeOptions("2025-01", 3, null, "2026-06");
    expect(options[0]).toBe("2025-01");
  });
});

// ─── buildHastaOptions ──────────────────────────────────────────────────────────

describe("buildHastaOptions", () => {
  it("la primera opción de 'Hasta' es siempre igual a 'Desde' (rango invertido irrepresentable)", () => {
    const options = buildHastaOptions("2026-06", "2025-01", 3, null);
    expect(options[0]).toBe("2026-06");
  });

  it("sin techo propio, la última opción es Desde + 23 meses (24 opciones máximo)", () => {
    const options = buildHastaOptions("2026-06", "2025-01", 1, null);
    expect(options.length).toBe(MAX_SKIP_RANGE_MONTHS);
    expect(options[options.length - 1]).toBe(addMonthsToKey("2026-06", MAX_SKIP_RANGE_MONTHS - 1));
  });

  it("checklist docs/design.md: Desde=Jun 2026 con techo indefinido → Hasta ofrece hasta May 2028 (24 meses)", () => {
    const options = buildHastaOptions("2026-06", "2025-01", 1, null);
    expect(options[options.length - 1]).toBe("2028-05");
  });

  it("con techo del fijo antes de Desde+23, la última opción es el techo (no 24 meses ni solo apariciones)", () => {
    // Trimestral Ene 2025, fin exclusivo Oct 2025 → techo (última aparición) Jul 2025.
    const options = buildHastaOptions("2025-04", "2025-01", 3, "2025-10");
    expect(options).toEqual(["2025-04", "2025-05", "2025-06", "2025-07"]);
  });

  it("nunca ofrece más de MAX_SKIP_RANGE_MONTHS opciones", () => {
    const options = buildHastaOptions("2020-01", "2020-01", 1, null);
    expect(options.length).toBeLessThanOrEqual(MAX_SKIP_RANGE_MONTHS);
  });
});

// ─── countAppearances ───────────────────────────────────────────────────────────

describe("countAppearances", () => {
  it("trimestral (Ene 2025), rango Mar–Dic 2026 (10 meses): 3 apariciones reales, Abr–Oct 2026 (no Mar/Dic)", () => {
    // RN-016: dentro de Mar–Dic 2026 el fijo trimestral aparece en Abr, Jul y
    // Oct (los meses en que monthDiff(2025-01, mes) % 3 === 0) — 3 fechas, no
    // los 10 meses del rango elegido.
    const result = countAppearances("2025-01", 3, "2026-03", "2026-12");
    expect(result).toEqual({ count: 3, first: "2026-04", last: "2026-10" });
  });

  it("checklist docs/design.md: rango sin apariciones (Feb–Mar 2026) → count 0", () => {
    const result = countAppearances("2025-01", 3, "2026-02", "2026-03");
    expect(result).toEqual({ count: 0, first: null, last: null });
  });

  it("rango de un solo mes de aparición → count 1, first === last", () => {
    const result = countAppearances("2025-01", 3, "2026-04", "2026-04");
    expect(result).toEqual({ count: 1, first: "2026-04", last: "2026-04" });
  });

  it("rango que arranca antes del inicio del fijo: usa el arranque como piso efectivo", () => {
    const result = countAppearances("2025-01", 3, "2024-01", "2025-07");
    // Apariciones dentro de [2025-01, 2025-07]: ene, abr, jul → 3
    expect(result).toEqual({ count: 3, first: "2025-01", last: "2025-07" });
  });

  it("rango invertido (from > to, defensivo) → cero apariciones", () => {
    const result = countAppearances("2025-01", 3, "2026-08", "2026-01");
    expect(result).toEqual({ count: 0, first: null, last: null });
  });

  it("frecuencia mensual (1): cuenta todos los meses del rango", () => {
    const result = countAppearances("2026-01", 1, "2026-01", "2026-06");
    expect(result).toEqual({ count: 6, first: "2026-01", last: "2026-06" });
  });

  it("frecuencia 5 (no divisor de 12): conteo correcto en un rango largo", () => {
    // Arranque Ene 2026, apariciones: ene, jun, nov 2026, abr 2027, set 2027...
    const result = countAppearances("2026-01", 5, "2026-01", "2027-09");
    expect(result).toEqual({ count: 5, first: "2026-01", last: "2027-09" });
  });

  it("idempotencia conceptual: rangos superpuestos cuentan cada uno sus propias apariciones reales", () => {
    const a = countAppearances("2025-01", 3, "2026-01", "2026-06");
    const b = countAppearances("2025-01", 3, "2026-04", "2026-12");
    expect(a.count).toBe(2); // ene, abr
    expect(b.count).toBe(3); // abr, jul, oct
  });
});
