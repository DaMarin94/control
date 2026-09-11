/**
 * Tests de `lib/fixed-evolution-colors.ts` (Ola 5, P6 — RF-REP-013).
 *
 * Verifica la regla de docs/design.md §"Detalle histórico de gastos fijos" §3:
 * - Opera sobre CUALQUIER hex de categoría, esté o no en la matriz de 40 (bug
 *   encontrado en QA: antes caía a rojo por fallback de lookup).
 * - Conserva hue y croma de origen; solo sustituye la claridad por un peldaño
 *   de la banda [0.46, 0.74] (claro/medio/oscuro).
 * - El ancla es el peldaño más cercano a la L propia de la categoría.
 * - Piso de croma 0.07 para colores con hue definido; los neutros (croma de
 *   origen < 0.015) conservan su croma sin hue inventado.
 * - Desempate por `ordinal` ASC (nunca el índice del array), recorriendo la
 *   escalera cíclicamente desde el ancla.
 */

import { describe, it, expect } from "vitest";
import { assignFixedEvolutionColors, hexToOklch } from "@/lib/fixed-evolution-colors";

/** Parsea un string `oklch(L C H)` a sus tres componentes numéricos. */
function parseOklch(value: string): { l: number; c: number; h: number } {
  const match = value.match(/^oklch\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)$/);
  if (!match) throw new Error(`No es un string oklch() válido: ${value}`);
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

const STEP_LS = [0.74, 0.6, 0.46];

describe("hexToOklch", () => {
  it("un gris puro tiene croma prácticamente nulo (acromático)", () => {
    const { c } = hexToOklch("#808080");
    expect(c).toBeLessThan(0.01);
  });

  it("un color vívido tiene croma sensiblemente mayor que un gris", () => {
    const { c: cRed } = hexToOklch("#E23B3B");
    const { c: cGray } = hexToOklch("#808080");
    expect(cRed).toBeGreaterThan(cGray);
  });

  it("hues opuestos (rojo vs. celeste) resuelven a ángulos de hue distantes", () => {
    const { h: hRed } = hexToOklch("#E23B3B");
    const { h: hBlue } = hexToOklch("#3B7DE0");
    const diff = Math.abs(hRed - hBlue);
    expect(Math.min(diff, 360 - diff)).toBeGreaterThan(60);
  });
});

describe("assignFixedEvolutionColors — color fuera de la matriz de 40 (bug QA)", () => {
  it("un hex que NO pertenece a la matriz de 40 no cae al rojo por fallback", () => {
    // #84A9D6 (Agua) — uno de los hexes del reporte de QA ausentes de la matriz.
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-agua", ordinal: 1, categoryColor: "#84A9D6" },
    ]);
    const assigned = colors.get("fx-agua")!;
    const { h } = parseOklch(assigned);
    const { h: hRed } = hexToOklch("#E23B3B");
    const diff = Math.abs(h - hRed);
    expect(Math.min(diff, 360 - diff)).toBeGreaterThan(30);
  });

  it("categorías distintas fuera de la matriz reciben hues distintos entre sí", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-agua", ordinal: 1, categoryColor: "#84A9D6" }, // Agua
      { chainId: "fx-ropa", ordinal: 2, categoryColor: "#BFA4E1" }, // Ropa
      { chainId: "fx-viaje", ordinal: 3, categoryColor: "#443458" }, // Viaje
    ]);
    const hues = ["fx-agua", "fx-ropa", "fx-viaje"].map((id) => parseOklch(colors.get(id)!).h);
    // Ninguna combinación de a pares debería coincidir en hue redondeado.
    expect(new Set(hues.map((h) => Math.round(h))).size).toBe(3);
  });

  it("la claridad resultante siempre cae en uno de los tres peldaños de la banda", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-1", ordinal: 1, categoryColor: "#84A9D6" },
      { chainId: "fx-2", ordinal: 1, categoryColor: "#E8C84A" },
      { chainId: "fx-3", ordinal: 1, categoryColor: "#443458" },
    ]);
    for (const value of colors.values()) {
      const { l } = parseOklch(value);
      expect(STEP_LS).toContain(l);
    }
  });
});

describe("assignFixedEvolutionColors — ancla por claridad propia", () => {
  it("un color muy claro (pastel) ancla en el peldaño claro (L 0.74)", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-pastel", ordinal: 1, categoryColor: "#F7C8C8" }, // L1 de la matriz
    ]);
    expect(parseOklch(colors.get("fx-pastel")!).l).toBe(0.74);
  });

  it("un color muy oscuro ancla en el peldaño oscuro (L 0.46)", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-oscuro", ordinal: 1, categoryColor: "#6C1C1C" }, // L5 de la matriz
    ]);
    expect(parseOklch(colors.get("fx-oscuro")!).l).toBe(0.46);
  });

  it("un color de claridad media ancla en el peldaño medio (L 0.60)", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-medio", ordinal: 1, categoryColor: "#E23B3B" }, // L3 de la matriz (vívida)
    ]);
    expect(parseOklch(colors.get("fx-medio")!).l).toBe(0.6);
  });
});

describe("assignFixedEvolutionColors — croma: piso y conservación de neutros", () => {
  it("un color con hue definido pero croma bajo se sube al piso 0.07", () => {
    // Un tono apenas saturado (croma de origen entre 0.015 y 0.07).
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-tenue", ordinal: 1, categoryColor: "#9A8E86" },
    ]);
    const { c: originC } = hexToOklch("#9A8E86");
    expect(originC).toBeGreaterThanOrEqual(0.015);
    expect(originC).toBeLessThan(0.07);
    expect(parseOklch(colors.get("fx-tenue")!).c).toBe(0.07);
  });

  it("un color deliberadamente neutro conserva su croma de origen sin piso", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-gris", ordinal: 1, categoryColor: "#808080" },
    ]);
    const { c: originC } = hexToOklch("#808080");
    expect(originC).toBeLessThan(0.015);
    const assignedC = parseOklch(colors.get("fx-gris")!).c;
    expect(assignedC).toBeCloseTo(originC, 2);
    expect(assignedC).toBeLessThan(0.07);
  });

  it("un color vívido conserva un croma por encima del piso", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-vivido", ordinal: 1, categoryColor: "#E23B3B" },
    ]);
    expect(parseOklch(colors.get("fx-vivido")!).c).toBeGreaterThan(0.07);
  });
});

describe("assignFixedEvolutionColors — desempate por ordinal, escalera cíclica", () => {
  it("dos fijos de la misma categoría reciben tonalidades (L) distintas, mismo hue", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-a", ordinal: 1, categoryColor: "#E23B3B" },
      { chainId: "fx-b", ordinal: 2, categoryColor: "#E23B3B" },
    ]);
    const a = parseOklch(colors.get("fx-a")!);
    const b = parseOklch(colors.get("fx-b")!);
    expect(a.l).not.toBe(b.l);
    expect(a.h).toBeCloseTo(b.h, 1);
    expect(a.c).toBeCloseTo(b.c, 4);
  });

  it("el desempate se resuelve por `ordinal` ASC, no por el orden del array", () => {
    // Ancla de #E23B3B es "medio" (L≈0.60) → escalera medio→oscuro→claro.
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-ordinal-2", ordinal: 2, categoryColor: "#E23B3B" },
      { chainId: "fx-ordinal-1", ordinal: 1, categoryColor: "#E23B3B" },
    ]);
    // El de menor ordinal (1) debe tomar el ancla (medio, L=0.60) pese a venir
    // segundo en el array.
    expect(parseOklch(colors.get("fx-ordinal-1")!).l).toBe(0.6);
    expect(parseOklch(colors.get("fx-ordinal-2")!).l).toBe(0.46);
  });

  it("con 3 fijos de la misma categoría, las tres claridades son distintas entre sí", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-1", ordinal: 1, categoryColor: "#E23B3B" },
      { chainId: "fx-2", ordinal: 2, categoryColor: "#E23B3B" },
      { chainId: "fx-3", ordinal: 3, categoryColor: "#E23B3B" },
    ]);
    const ls = ["fx-1", "fx-2", "fx-3"].map((id) => parseOklch(colors.get(id)!).l);
    expect(new Set(ls).size).toBe(3);
    expect(new Set(ls)).toEqual(new Set(STEP_LS));
  });

  it("el 4º fijo de la misma categoría recicla el trazo del 1º (mismo ancla)", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-1", ordinal: 1, categoryColor: "#E23B3B" },
      { chainId: "fx-2", ordinal: 2, categoryColor: "#E23B3B" },
      { chainId: "fx-3", ordinal: 3, categoryColor: "#E23B3B" },
      { chainId: "fx-4", ordinal: 4, categoryColor: "#E23B3B" },
    ]);
    expect(colors.get("fx-4")).toBe(colors.get("fx-1"));
  });

  it("agrupa por hex normalizado (mayúsculas/minúsculas indistinto)", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-upper", ordinal: 1, categoryColor: "#E23B3B" },
      { chainId: "fx-lower", ordinal: 2, categoryColor: "#e23b3b" },
    ]);
    // Al compartir hex (normalizado), participan del mismo desempate: L distintas.
    expect(parseOklch(colors.get("fx-upper")!).l).not.toBe(parseOklch(colors.get("fx-lower")!).l);
  });

  it("categorías con hex distinto NO comparten desempate (cada una ancla independiente)", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-rojo", ordinal: 1, categoryColor: "#E23B3B" },
      { chainId: "fx-teal", ordinal: 2, categoryColor: "#1AA5B0" },
    ]);
    // Ambos son ordinal más bajo de su propio grupo → ambos anclan en su propio peldaño medio.
    expect(parseOklch(colors.get("fx-rojo")!).l).toBe(0.6);
    expect(parseOklch(colors.get("fx-teal")!).l).toBe(0.6);
  });
});

describe("assignFixedEvolutionColors — formato de salida", () => {
  it("devuelve un string oklch(L C H) parseable para cada línea", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "fx-1", ordinal: 1, categoryColor: "#8B4FD4" },
    ]);
    expect(() => parseOklch(colors.get("fx-1")!)).not.toThrow();
  });
});
