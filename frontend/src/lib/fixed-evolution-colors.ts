/**
 * Clave de color de las líneas de la card `fixed-evolution` (Ola 5, P6 — RF-REP-013).
 *
 * Regla (docs/design.md §"Detalle histórico de gastos fijos" §3 — "La clave de
 * color: el color lo da la categoría, la tonalidad desempata"):
 *
 *   El color de la línea es el **color de la categoría re-anclado a una banda de
 *   claridad legible**: se toma `category.color` en OKLCH, se **conservan hue y
 *   croma**, y se sustituye la claridad (L) por uno de tres peldaños de la banda
 *   `[0.46, 0.74]` (separación ~0.14 L): T-claro 0.74, T-medio 0.60, T-oscuro 0.46.
 *
 *   - **Ancla:** el peldaño más cercano a la L propia de la categoría —
 *     `L ≥ 0.67` → claro; `0.53 ≤ L < 0.67` → medio; `L < 0.53` → oscuro.
 *   - **Croma:** se conserva el de origen, con **piso 0.07** para colores con hue
 *     definido (croma de origen `≥ 0.015`). Los colores deliberadamente neutros
 *     (croma `< 0.015`) conservan su croma sin hue inventado.
 *   - **Desempate:** los fijos que comparten el mismo hex de categoría (normalizado)
 *     se ordenan por `ordinal` ASC (estable entre años — nunca el índice del array,
 *     que sigue el gasto anual del año mostrado) y recorren la escalera **desde el
 *     ancla hacia abajo, cíclicamente** (con ancla medio: medio → oscuro → claro;
 *     con ancla claro: claro → medio → oscuro; con ancla oscuro: oscuro → claro →
 *     medio). A partir del 4º fijo de esa categoría, recicla desde el ancla.
 *
 *   **Sin lookup ni tabla de hexes:** la regla opera sobre CUALQUIER hex que venga
 *   en `categoryColor`, pertenezca o no a la matriz de 40 colores de categoría. El
 *   resultado se emite como `oklch(L C H)` — el navegador hace el gamut mapping a
 *   sRGB para el par L/H pedido (Recharts lo acepta como `stroke`/`fill`).
 */

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

/** Piso de croma para colores con hue definido (§3.3). */
const CHROMA_FLOOR = 0.07;
/** Bajo este croma de origen, el color se considera deliberadamente neutro (§3.3). */
const NEUTRAL_CHROMA_THRESHOLD = 0.015;

/** Ancla: el peldaño más cercano a la L propia de la categoría (§3.2). */
function anchorStep(l: number): Step {
  if (l >= 0.67) return "light";
  if (l >= 0.53) return "medium";
  return "dark";
}

/** Escalera cíclica desde el ancla hacia abajo (recicla cada 3 fijos, §3.4). */
const LADDER: Record<Step, readonly Step[]> = {
  medium: ["medium", "dark", "light"],
  light: ["light", "medium", "dark"],
  dark: ["dark", "light", "medium"],
};

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${round(l, 2)} ${round(c, 4)} ${round(h, 2)})`;
}

/**
 * Asigna el color de línea (string `oklch(L C H)`) a cada fijo del universo dado.
 *
 * @param lines Universo de líneas del año mostrado (chainId, ordinal, categoryColor).
 *              El `ordinal` es estable entre años (docs/design.md §14); se usa para
 *              determinar el orden de desempate dentro de cada hex de categoría, NO
 *              el orden del array (que sigue el gasto anual del año mostrado).
 * @returns Map chainId -> `oklch(L C H)`.
 */
export function assignFixedEvolutionColors(
  lines: ReadonlyArray<{ chainId: string; ordinal: number; categoryColor: string }>,
): Map<string, string> {
  const byHex = new Map<string, Array<{ chainId: string; ordinal: number }>>();

  for (const line of lines) {
    const key = line.categoryColor.trim().toUpperCase();
    const group = byHex.get(key);
    if (group) {
      group.push({ chainId: line.chainId, ordinal: line.ordinal });
    } else {
      byHex.set(key, [{ chainId: line.chainId, ordinal: line.ordinal }]);
    }
  }

  const result = new Map<string, string>();
  for (const [hex, group] of byHex) {
    const { l: l0, c: c0, h: h0 } = hexToOklch(hex);
    const hasHue = c0 >= NEUTRAL_CHROMA_THRESHOLD;
    const c = hasHue ? Math.max(c0, CHROMA_FLOOR) : c0;
    const ladder = LADDER[anchorStep(l0)];

    const sorted = [...group].sort((a, b) => a.ordinal - b.ordinal);
    sorted.forEach((item, i) => {
      const step = ladder[i % ladder.length]!;
      result.set(item.chainId, formatOklch(STEP_L[step], c, h0));
    });
  }
  return result;
}
