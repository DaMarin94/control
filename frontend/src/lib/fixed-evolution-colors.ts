/**
 * Clave de color de las líneas de la card `fixed-evolution` (RF-REP-013).
 *
 * Regla (docs/design.md §"Detalle histórico de fijos" §3):
 *
 *   - **Card de reportes:** cada fijo toma `FX[ordinal mod 12]`, una paleta
 *     categórica propia de 12 colores (6 hues x 2 claridades), valores fijos en
 *     claro y oscuro. El color es identificador de fijo: no codifica categoría ni
 *     dirección. `ordinal` es estable entre rangos (nunca el índice del array).
 *     Más de 12 fijos: se recicla por `ordinal mod 12`.
 *   - **Variante acotada (§3 punto 5, §15):** la única línea usa el color de su
 *     categoría re-anclado a la banda de trazo `[0.46, 0.74]` (`anchorFixedEvolutionColor`):
 *     hue y croma conservados (piso 0.07 si croma de origen >= 0.015), claridad
 *     al peldaño más cercano (L >= 0.67 -> 0.74; 0.53 <= L < 0.67 -> 0.60;
 *     L < 0.53 -> 0.46). Sin desempate ni escalera.
 */

/** Paleta `FX` (docs/design.md §3): 12 colores `oklch()` literales. */
export const FX_PALETTE: readonly string[] = [
  "oklch(0.50 0.11 240)",
  "oklch(0.70 0.15 66)",
  "oklch(0.50 0.16 320)",
  "oklch(0.70 0.11 205)",
  "oklch(0.50 0.16 350)",
  "oklch(0.72 0.13 90)",
  "oklch(0.70 0.12 240)",
  "oklch(0.50 0.09 66)",
  "oklch(0.70 0.14 320)",
  "oklch(0.50 0.08 205)",
  "oklch(0.70 0.15 350)",
  "oklch(0.52 0.10 90)",
];

// ─── Conversión hex sRGB → OKLCH (Björn Ottosson) ────────────────────────────

function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Parsea un hex (#RGB o #RRGGBB) a componentes sRGB en [0,1]. */
function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const num = parseInt(h, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/** Convierte un hex sRGB a OKLCH: `{ l: [0,1], c: [0, ~0.4], h: [0,360) }`. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const { r, g, b } = parseHex(hex);
  const lr = srgbChannelToLinear(r);
  const lg = srgbChannelToLinear(g);
  const lb = srgbChannelToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bLab * bLab);
  let H = (Math.atan2(bLab, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

// ─── Banda de trazo — tres peldaños de claridad (docs/design.md §3.1) ────────

type Step = "light" | "medium" | "dark";

/** L de cada peldaño de la banda de trazo legible [0.46, 0.74]. */
const STEP_L: Record<Step, number> = { light: 0.74, medium: 0.6, dark: 0.46 };

/** Piso de croma para colores con hue definido. */
const CHROMA_FLOOR = 0.07;
/** Bajo este croma de origen, el color se considera deliberadamente neutro. */
const NEUTRAL_CHROMA_THRESHOLD = 0.015;

/** Ancla: el peldaño más cercano a la L propia de la categoría. */
function anchorStep(l: number): Step {
  if (l >= 0.67) return "light";
  if (l >= 0.53) return "medium";
  return "dark";
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${round(l, 2)} ${round(c, 4)} ${round(h, 2)})`;
}

/**
 * Asigna a cada fijo su color de la paleta `FX`: `FX[ordinal mod 12]`.
 * `ordinal` es 0-based y estable entre rangos (docs/design.md §14).
 *
 * @returns Map chainId -> `oklch(L C H)`.
 */
export function assignFixedEvolutionColors(
  lines: ReadonlyArray<{ chainId: string; ordinal: number }>,
): Map<string, string> {
  const result = new Map<string, string>();
  const n = FX_PALETTE.length;
  for (const line of lines) {
    result.set(line.chainId, FX_PALETTE[((line.ordinal % n) + n) % n]!);
  }
  return result;
}

/**
 * Color de la variante acotada (§3 punto 5): el de la categoría re-anclado a la
 * banda de trazo. Opera sobre cualquier hex, sin lookup en la matriz.
 */
export function anchorFixedEvolutionColor(categoryColor: string): string {
  const { l, c: c0, h } = hexToOklch(categoryColor);
  const c = c0 >= NEUTRAL_CHROMA_THRESHOLD ? Math.max(c0, CHROMA_FLOOR) : c0;
  return formatOklch(STEP_L[anchorStep(l)], c, h);
}
