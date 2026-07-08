/**
 * Tests del evaluador client-side de límites (P2 — Fase 1, marca visual pasiva).
 *
 * Cubre:
 * - Cero impacto con `limits: []` (D9)
 * - Filtro por anchorKey / enabled / nature (solo "passive")
 * - Los 5 operadores (gt/gte/lt/lte/eq)
 * - temporalScope "all" vs "current" (isCurrentMonth)
 * - Refinamiento: universal (sin refinement) vs acotado (section / categoryId)
 * - Colisión: la marca más fuerte gana; el texto accesible enumera todos los cruzados
 * - mergeLimitMarks combina dos marcas (item + categoría) del mismo dato renderizado
 */

import { describe, it, expect } from "vitest";
import { evaluateLimits, describeLimitMark, mergeLimitMarks, matchActiveLimits } from "@/lib/limits/evaluate";
import type { LimitConfig } from "@/types/limit";

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: overrides.id ?? "limit-1",
    enabled: true,
    anchorKey: "mes.total.gasto",
    temporalScope: "all",
    operator: "gt",
    threshold: 300000,
    nature: "passive",
    effect: "badge",
    ...overrides,
  };
}

describe("evaluateLimits", () => {
  it("devuelve null con limits vacío (cero impacto, D9)", () => {
    const result = evaluateLimits({
      limits: [],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    });
    expect(result).toBeNull();
  });

  it("devuelve null si ningún límite cruza la condición", () => {
    const result = evaluateLimits({
      limits: [makeLimit({ threshold: 300000, operator: "gt" })],
      anchorKey: "mes.total.gasto",
      value: 100000,
      isCurrentMonth: true,
    });
    expect(result).toBeNull();
  });

  it("devuelve la marca cuando el límite cruza (gt)", () => {
    const result = evaluateLimits({
      limits: [makeLimit({ threshold: 300000, operator: "gt", effect: "glyph" })],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    });
    expect(result).not.toBeNull();
    expect(result?.effect).toBe("glyph");
    expect(result?.matched).toHaveLength(1);
  });

  it("ignora límites deshabilitados (enabled=false)", () => {
    const result = evaluateLimits({
      limits: [makeLimit({ enabled: false })],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    });
    expect(result).toBeNull();
  });

  it("ignora límites de otro anchorKey", () => {
    const result = evaluateLimits({
      limits: [makeLimit({ anchorKey: "mes.total.ingreso" })],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    });
    expect(result).toBeNull();
  });

  it("ignora límites nature='active' (Fase 2, fuera de este evaluador)", () => {
    const result = evaluateLimits({
      limits: [makeLimit({ nature: "active" })],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    });
    expect(result).toBeNull();
  });

  describe("operadores", () => {
    it.each([
      ["gt", 300000, 300001, true],
      ["gt", 300000, 300000, false],
      ["gte", 300000, 300000, true],
      ["gte", 300000, 299999, false],
      ["lt", 300000, 299999, true],
      ["lt", 300000, 300000, false],
      ["lte", 300000, 300000, true],
      ["lte", 300000, 300001, false],
      ["eq", 300000, 300000, true],
      ["eq", 300000, 300001, false],
    ] as const)("%s con threshold=%d y value=%d → cruza=%s", (operator, threshold, value, expected) => {
      const result = evaluateLimits({
        limits: [makeLimit({ operator, threshold })],
        anchorKey: "mes.total.gasto",
        value,
        isCurrentMonth: true,
      });
      expect(result !== null).toBe(expected);
    });
  });

  describe("temporalScope", () => {
    it("'all' aplica sin importar isCurrentMonth", () => {
      const result = evaluateLimits({
        limits: [makeLimit({ temporalScope: "all" })],
        anchorKey: "mes.total.gasto",
        value: 500000,
        isCurrentMonth: false,
      });
      expect(result).not.toBeNull();
    });

    it("'current' NO aplica si isCurrentMonth=false", () => {
      const result = evaluateLimits({
        limits: [makeLimit({ temporalScope: "current" })],
        anchorKey: "mes.total.gasto",
        value: 500000,
        isCurrentMonth: false,
      });
      expect(result).toBeNull();
    });

    it("'current' SÍ aplica si isCurrentMonth=true", () => {
      const result = evaluateLimits({
        limits: [makeLimit({ temporalScope: "current" })],
        anchorKey: "mes.total.gasto",
        value: 500000,
        isCurrentMonth: true,
      });
      expect(result).not.toBeNull();
    });
  });

  describe("refinamiento", () => {
    it("un límite SIN refinamiento aplica a cualquier instancia (universal)", () => {
      const result = evaluateLimits({
        limits: [makeLimit({ anchorKey: "mes.item.monto", threshold: 1000 })],
        anchorKey: "mes.item.monto",
        value: 2000,
        refinement: { categoryId: "cat-1" },
        isCurrentMonth: true,
      });
      expect(result).not.toBeNull();
    });

    it("un límite con refinement.section solo aplica si coincide la sección", () => {
      const limit = makeLimit({
        anchorKey: "mes.seccion.subtotal",
        threshold: 1000,
        refinement: { section: "unicos" },
      });
      const matches = evaluateLimits({
        limits: [limit],
        anchorKey: "mes.seccion.subtotal",
        value: 2000,
        refinement: { section: "unicos" },
        isCurrentMonth: true,
      });
      const noMatch = evaluateLimits({
        limits: [limit],
        anchorKey: "mes.seccion.subtotal",
        value: 2000,
        refinement: { section: "fijos" },
        isCurrentMonth: true,
      });
      expect(matches).not.toBeNull();
      expect(noMatch).toBeNull();
    });

    it("un límite con refinement.categoryId solo aplica si coincide la categoría", () => {
      const limit = makeLimit({
        anchorKey: "mes.categoria.gastoMes",
        threshold: 1000,
        refinement: { categoryId: "cat-1" },
      });
      const matches = evaluateLimits({
        limits: [limit],
        anchorKey: "mes.categoria.gastoMes",
        value: 2000,
        refinement: { categoryId: "cat-1" },
        isCurrentMonth: true,
      });
      const noMatch = evaluateLimits({
        limits: [limit],
        anchorKey: "mes.categoria.gastoMes",
        value: 2000,
        refinement: { categoryId: "cat-2" },
        isCurrentMonth: true,
      });
      expect(matches).not.toBeNull();
      expect(noMatch).toBeNull();
    });
  });

  describe("colisión — varios límites cruzan", () => {
    it("elige el efecto más fuerte entre los cruzados (ring > badge > glyph)", () => {
      const result = evaluateLimits({
        limits: [
          makeLimit({ id: "l1", threshold: 100000, effect: "glyph" }),
          makeLimit({ id: "l2", threshold: 200000, effect: "ring" }),
          makeLimit({ id: "l3", threshold: 300000, effect: "badge" }),
        ],
        anchorKey: "mes.total.gasto",
        value: 500000,
        isCurrentMonth: true,
      });
      expect(result?.effect).toBe("ring");
      expect(result?.matched).toHaveLength(3);
    });

    it("usa el defaultEffect del catálogo cuando el límite no trae `effect`", () => {
      const result = evaluateLimits({
        limits: [makeLimit({ effect: undefined })],
        anchorKey: "mes.total.gasto",
        value: 500000,
        isCurrentMonth: true,
      });
      // mes.total.gasto: defaultEffect = "badge" (ver lib/limits/catalog.ts)
      expect(result?.effect).toBe("badge");
    });
  });
});

describe("describeLimitMark", () => {
  it("usa el label del límite si está presente", () => {
    const mark = evaluateLimits({
      limits: [makeLimit({ label: "Mi límite de gasto" })],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    })!;
    expect(describeLimitMark(mark)).toBe("Supera el límite: Mi límite de gasto");
  });

  it("deriva el placeholder cuando no hay label (key legible + condición)", () => {
    const mark = evaluateLimits({
      limits: [makeLimit({ threshold: 300000, operator: "gt" })],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    })!;
    expect(describeLimitMark(mark)).toBe("Supera el límite: Gasto del mes > 300.000");
  });

  it("enumera TODOS los límites cruzados, no solo el ganador de la colisión", () => {
    const mark = evaluateLimits({
      limits: [
        makeLimit({ id: "l1", threshold: 100000, effect: "glyph", label: "Suave" }),
        makeLimit({ id: "l2", threshold: 400000, effect: "ring", label: "Fuerte" }),
      ],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    })!;
    const description = describeLimitMark(mark);
    expect(description).toContain("Suave");
    expect(description).toContain("Fuerte");
  });

  it("mes.categoria.gastoMes SIN label: enuncia el cruce a nivel categoría-mes, no el monto de la fila", () => {
    const mark = evaluateLimits({
      limits: [
        makeLimit({
          anchorKey: "mes.categoria.gastoMes",
          threshold: 300000,
          refinement: { categoryId: "cat-1" },
        }),
      ],
      anchorKey: "mes.categoria.gastoMes",
      value: 500000,
      refinement: { categoryId: "cat-1" },
      isCurrentMonth: true,
    })!;
    expect(describeLimitMark(mark, { categoryName: "Alimentación" })).toBe(
      "Gasto del mes en Alimentación supera el límite",
    );
  });

  it("mes.categoria.gastoMes CON label: respeta el label del límite (igual que el resto de las keys)", () => {
    const mark = evaluateLimits({
      limits: [
        makeLimit({
          anchorKey: "mes.categoria.gastoMes",
          threshold: 300000,
          refinement: { categoryId: "cat-1" },
          label: "Comida al límite",
        }),
      ],
      anchorKey: "mes.categoria.gastoMes",
      value: 500000,
      refinement: { categoryId: "cat-1" },
      isCurrentMonth: true,
    })!;
    expect(describeLimitMark(mark, { categoryName: "Alimentación" })).toBe(
      "Supera el límite: Comida al límite",
    );
  });
});

describe("matchActiveLimits (P2 — Fase 2, evaluador write-path de la naturaleza activa)", () => {
  it("devuelve [] con limits vacío", () => {
    expect(matchActiveLimits([], "mes.total.gasto", 500000)).toEqual([]);
  });

  it("solo consume límites nature='active' (ignora 'passive')", () => {
    const passive = makeLimit({ nature: "passive", temporalScope: "all", threshold: 100 });
    expect(matchActiveLimits([passive], "mes.total.gasto", 500000)).toEqual([]);
  });

  it("ignora límites deshabilitados", () => {
    const limit = makeLimit({ nature: "active", enabled: false, threshold: 100 });
    expect(matchActiveLimits([limit], "mes.total.gasto", 500000)).toEqual([]);
  });

  it("ignora límites de otro anchorKey", () => {
    const limit = makeLimit({ nature: "active", anchorKey: "mes.total.ingreso", threshold: 100 });
    expect(matchActiveLimits([limit], "mes.total.gasto", 500000)).toEqual([]);
  });

  it("devuelve el límite cuando cruza la condición", () => {
    const limit = makeLimit({ id: "l1", nature: "active", operator: "gt", threshold: 300000 });
    const result = matchActiveLimits([limit], "mes.total.gasto", 500000);
    expect(result.map((l) => l.id)).toEqual(["l1"]);
  });

  it("IGNORA temporalScope (D20) — cruza sin importar si el límite lo trae seteado", () => {
    const limit = makeLimit({ nature: "active", operator: "gt", threshold: 100, temporalScope: "current" });
    // No se pasa isCurrentMonth — matchActiveLimits no tiene ese parámetro
    const result = matchActiveLimits([limit], "mes.total.gasto", 500000);
    expect(result).toHaveLength(1);
  });

  it("respeta el refinamiento (section / categoryId)", () => {
    const limit = makeLimit({
      nature: "active",
      anchorKey: "mes.seccion.subtotal",
      operator: "gt",
      threshold: 100,
      refinement: { section: "unicos" },
    });
    const matches = matchActiveLimits([limit], "mes.seccion.subtotal", 500, { section: "unicos" });
    const noMatch = matchActiveLimits([limit], "mes.seccion.subtotal", 500, { section: "fijos" });
    expect(matches).toHaveLength(1);
    expect(noMatch).toHaveLength(0);
  });

  it("devuelve TODOS los límites activos que cruzan (D18), no solo el primero", () => {
    const l1 = makeLimit({ id: "l1", nature: "active", operator: "gt", threshold: 100 });
    const l2 = makeLimit({ id: "l2", nature: "active", operator: "gt", threshold: 200 });
    const result = matchActiveLimits([l1, l2], "mes.total.gasto", 500000);
    expect(result.map((l) => l.id).sort()).toEqual(["l1", "l2"]);
  });
});

describe("mergeLimitMarks", () => {
  it("devuelve la marca no-nula cuando la otra es null", () => {
    const mark = evaluateLimits({
      limits: [makeLimit()],
      anchorKey: "mes.total.gasto",
      value: 500000,
      isCurrentMonth: true,
    });
    expect(mergeLimitMarks(mark, null)).toEqual(mark);
    expect(mergeLimitMarks(null, mark)).toEqual(mark);
  });

  it("devuelve null si ambas son null", () => {
    expect(mergeLimitMarks(null, null)).toBeNull();
  });

  it("combina dos marcas eligiendo el efecto más fuerte y uniendo los límites cruzados", () => {
    const itemMark = evaluateLimits({
      limits: [makeLimit({ id: "item-limit", anchorKey: "mes.item.monto", effect: "glyph", threshold: 1000 })],
      anchorKey: "mes.item.monto",
      value: 2000,
      isCurrentMonth: true,
    });
    const categoryMark = evaluateLimits({
      limits: [
        makeLimit({
          id: "cat-limit",
          anchorKey: "mes.categoria.gastoMes",
          effect: "fill",
          threshold: 1000,
          refinement: { categoryId: "cat-1" },
        }),
      ],
      anchorKey: "mes.categoria.gastoMes",
      value: 2000,
      refinement: { categoryId: "cat-1" },
      isCurrentMonth: true,
    });

    const merged = mergeLimitMarks(itemMark, categoryMark);
    expect(merged?.effect).toBe("fill"); // fill (6) > glyph (3)
    expect(merged?.matched.map((l) => l.id).sort()).toEqual(["cat-limit", "item-limit"]);
  });
});
