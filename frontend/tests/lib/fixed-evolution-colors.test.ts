/**
 * Tests de `lib/fixed-evolution-colors.ts` (RF-REP-013).
 *
 * docs/design.md §"Detalle histórico de fijos" §3:
 * - Card de reportes: `FX[ordinal mod 12]` (paleta de 12), estable entre rangos,
 *   sin depender de la categoría ni del índice del array; recicla mod 12.
 * - Variante acotada: color de categoría re-anclado (`anchorFixedEvolutionColor`).
 */

import { describe, it, expect } from "vitest";
import {
  assignFixedEvolutionColors,
  hexToOklch,
  anchorFixedEvolutionColor,
  FX_PALETTE,
} from "@/lib/fixed-evolution-colors";

function parseOklch(value: string): { l: number; c: number; h: number } {
  const match = value.match(/^oklch\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)$/);
  if (!match) throw new Error(`No es un string oklch() válido: ${value}`);
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

/** OKLCH -> sRGB lineal (Ottosson); sin clamp, para medir el gamut. */
function oklchToLinearSrgb({ l, c, h }: { l: number; c: number; h: number }): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const STEP_LS = [0.74, 0.6, 0.46];

describe("hexToOklch", () => {
  it("un gris puro tiene croma prácticamente nulo", () => {
    expect(hexToOklch("#808080").c).toBeLessThan(0.01);
  });

  it("hues opuestos (rojo vs. celeste) resuelven a ángulos distantes", () => {
    const diff = Math.abs(hexToOklch("#E23B3B").h - hexToOklch("#3B7DE0").h);
    expect(Math.min(diff, 360 - diff)).toBeGreaterThan(60);
  });
});

describe("FX_PALETTE", () => {
  it("tiene 12 colores oklch() distintos", () => {
    expect(FX_PALETTE).toHaveLength(12);
    expect(new Set(FX_PALETTE).size).toBe(12);
    FX_PALETTE.forEach((c) => expect(() => parseOklch(c)).not.toThrow());
  });

  it("los 12 colores caen dentro del gamut sRGB (sin tolerancia)", () => {
    for (const color of FX_PALETTE) {
      const rgb = oklchToLinearSrgb(parseOklch(color));
      for (const ch of rgb) {
        expect(ch, color).toBeGreaterThanOrEqual(0);
        expect(ch, color).toBeLessThanOrEqual(1);
      }
    }
  });

  it("las claridades están dentro de la banda de trazo [0.46, 0.74]", () => {
    for (const color of FX_PALETTE) {
      const { l } = parseOklch(color);
      expect(l).toBeGreaterThanOrEqual(0.46);
      expect(l).toBeLessThanOrEqual(0.74);
    }
  });
});

describe("assignFixedEvolutionColors — FX[ordinal mod 12]", () => {
  it("asigna FX[ordinal] por chainId", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "a", ordinal: 0 },
      { chainId: "b", ordinal: 5 },
      { chainId: "c", ordinal: 11 },
    ]);
    expect(colors.get("a")).toBe(FX_PALETTE[0]);
    expect(colors.get("b")).toBe(FX_PALETTE[5]);
    expect(colors.get("c")).toBe(FX_PALETTE[11]);
  });

  it("recicla por ordinal mod 12", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "a", ordinal: 12 },
      { chainId: "b", ordinal: 13 },
      { chainId: "c", ordinal: 25 },
    ]);
    expect(colors.get("a")).toBe(FX_PALETTE[0]);
    expect(colors.get("b")).toBe(FX_PALETTE[1]);
    expect(colors.get("c")).toBe(FX_PALETTE[1]);
  });

  it("no depende del orden del array ni del universo: el mismo ordinal da el mismo color", () => {
    const full = assignFixedEvolutionColors([
      { chainId: "x", ordinal: 7 },
      { chainId: "y", ordinal: 2 },
    ]);
    const reordered = assignFixedEvolutionColors([{ chainId: "y", ordinal: 2 }, { chainId: "x", ordinal: 7 }]);
    const alone = assignFixedEvolutionColors([{ chainId: "x", ordinal: 7 }]);
    expect(full.get("x")).toBe(reordered.get("x"));
    expect(full.get("x")).toBe(alone.get("x"));
  });

  it("la categoría no interviene: mismo ordinal con distinta categoría = mismo color", () => {
    const colors = assignFixedEvolutionColors([
      { chainId: "a", ordinal: 3, categoryColor: "#E23B3B" } as { chainId: string; ordinal: number },
      { chainId: "b", ordinal: 3, categoryColor: "#1AA5B0" } as { chainId: string; ordinal: number },
    ]);
    expect(colors.get("a")).toBe(colors.get("b"));
  });

  it("ordinales consecutivos reciben colores distintos", () => {
    const colors = assignFixedEvolutionColors(Array.from({ length: 12 }, (_, i) => ({ chainId: `c${i}`, ordinal: i })));
    expect(new Set(colors.values()).size).toBe(12);
  });
});

describe("anchorFixedEvolutionColor — variante acotada (color de categoría)", () => {
  it("color de claridad media ancla en L 0.60", () => {
    expect(parseOklch(anchorFixedEvolutionColor("#E23B3B")).l).toBe(0.6);
  });

  it("pastel ancla claro (0.74) y muy oscuro ancla oscuro (0.46)", () => {
    expect(parseOklch(anchorFixedEvolutionColor("#F7C8C8")).l).toBe(0.74);
    expect(parseOklch(anchorFixedEvolutionColor("#6C1C1C")).l).toBe(0.46);
  });

  it("la claridad siempre cae en uno de los tres peldaños", () => {
    for (const hex of ["#84A9D6", "#E8C84A", "#443458"]) {
      expect(STEP_LS).toContain(parseOklch(anchorFixedEvolutionColor(hex)).l);
    }
  });

  it("conserva el hue de la categoría (hex fuera de la matriz)", () => {
    const origin = hexToOklch("#84A9D6").h;
    const out = parseOklch(anchorFixedEvolutionColor("#84A9D6")).h;
    expect(Math.abs(out - origin)).toBeLessThan(0.1);
  });

  it("croma: piso 0.07 con hue definido; neutros conservan su croma", () => {
    expect(parseOklch(anchorFixedEvolutionColor("#9A8E86")).c).toBe(0.07);
    const originC = hexToOklch("#808080").c;
    expect(originC).toBeLessThan(0.015);
    expect(parseOklch(anchorFixedEvolutionColor("#808080")).c).toBeCloseTo(originC, 2);
  });

  it("es determinista (sin desempate)", () => {
    expect(anchorFixedEvolutionColor("#E23B3B")).toBe(anchorFixedEvolutionColor("#E23B3B"));
  });
});
