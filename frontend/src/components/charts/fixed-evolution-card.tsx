"use client";

/**
 * FixedEvolutionCard — Card de reporte "Detalle histórico de fijos"
 * (RF-REP-013). Ola 6: migrada de año calendario navegable a un RANGO DE
 * MESES CORRIDOS anclado al presente (3..60 meses, borde derecho siempre el
 * mes en curso).
 *
 * Gráfico de líneas (Recharts LineChart) con UNA LÍNEA POR FIJO (gasto o
 * ingreso) — sin total, sin suma, sin agregación de ningún tipo. Alcance: fijos
 * EXPENSE e INCOME (más sus calculados derivados, siempre EXPENSE); no cuotas,
 * no únicos. La dirección va por canales propios (docs/design.md §3.1): forma
 * del punto (círculo gasto / cuadrado ingreso), glifo ArrowUp en listas, color
 * por tipo de la cifra del tooltip; NUNCA en el color del trazo.
 *
 * VARIANTE ACOTADA (RF-VM-009, docs/design.md §15): con la prop `chainId` la
 * misma card se monta dentro de la vista evolución de la card de detalle de
 * /mes para UN solo fijo — sin envase de card, título, tabs, chip, moneda,
 * refrescar, quitar, leyenda, excluidos ni nota de recorte; canvas de 240px con
 * la única línea en tratamiento de destacado permanente. El rango lo controla
 * quien la monta (`rangeMonths` + `onRangeMonthsChange`), sin persistencia.
 *
 * Piezas propias de esta card (no existían antes en el lenguaje visual):
 *   1. Clave de color por fijo: paleta categórica `FX` de 12 colores,
 *      `FX[ordinal mod 12]` (NUNCA el índice del array, que varía con el rango).
 *      La variante acotada usa en cambio el color de su categoría re-anclado —
 *      ver `lib/fixed-evolution-colors.ts`.
 *   2. El hueco como dato: la ausencia NO se grafica en cero. El PORTADOR
 *      PRINCIPAL del hueco es el trazo (puente atenuado, opacidad 0.35, solo
 *      en Montos) — no escala con el largo del rango; el punto es apoyo
 *      densidad-adaptativo (§4 del spec). El motivo del hueco es alcanzable
 *      en el tooltip de línea destacada.
 *   3. Eje X de largo variable (3..60 posiciones) con cadencia de rótulos por
 *      tramo + frontera de año (vertical `--hair` en cada enero interior).
 *   4. Destacado por hover: aísla una línea sin tocar la selección.
 *   5. Leyenda-selector de fijos: reemplaza al filtro de categorías, con su
 *      superficie de excluidos (fijos con <2 apariciones en el rango).
 *
 * Modo de visualización: 2 tabs (Montos / Variación) + 1 chip modificador
 * (Ajustada por inflación, solo aplica a Variación). Los 3 modos vienen
 * CALCULADOS del backend (`amountCents`, `nominalPct`, `adjustedPct`); el
 * front no deriva variaciones.
 *
 * Spec visual: docs/design.md §"Reporte 'Detalle histórico de gastos fijos' —
 * gráfico de líneas por fijo (fixed-evolution)".
 *
 * Gotchas:
 *   - `amountCents: 0` con `reason: null` es un punto REAL (RN-018); el hueco es
 *     `amountCents: null` + `reason` no-null. No colapsar ambos casos.
 *   - El color se asigna por `ordinal` (estable entre rangos), nunca por el
 *     índice del array `lines` (que sigue el gasto TOTAL del rango DESC).
 *   - `rangeMonths` de la respuesta es el EFECTIVO (post-recorte), puede ser
 *     MENOR al pedido (persistido). Comparar ambos para la nota de recorte;
 *     NUNCA sobreescribir el persistido con el efectivo.
 *   - El eje X ya no es 12 posiciones fijas: se reconstruye desde
 *     `data.startMonth` + `data.rangeMonths` (siempre `data.rangeMonths`
 *     meses corridos hasta `data.endMonth`, que es siempre el mes en curso).
 *   - Puente atenuado: se implementa como una `<Line>` extra POR TRAMO DE
 *     HUECO INTERNO (flanco a flanco), no como un solo dataKey con
 *     `connectNulls` global — con un único dataKey, `connectNulls` uniría
 *     TODOS los puntos no-nulos de la serie sin respetar los huecos entre
 *     tramos ya "puenteados" (dibujaría diagonales fantasma saltándose tramos
 *     planos intermedios). Una `<Line>` por tramo, con un dataKey sintético
 *     `${chainId}__bridge__${runIndex}` no-nulo solo en sus dos flancos,
 *     resuelve esto sin ambigüedad. La línea "plena" usa `connectNulls=false`
 *     (nunca puentea sola: solo conecta posiciones temporalmente adyacentes).
 *   - Densidad de puntos (`slot` = ancho de plot ÷ posiciones) se mide en
 *     vivo con `ResizeObserver` sobre el panel del canvas — no se deriva del
 *     rango elegido (el mismo rango en 1120px y en 352px son dos problemas
 *     distintos). Sin medición (SSR/test), el `slot` cae a 0 → densidad
 *     mínima seguro (nunca de más): siguen los tres puntos irrenunciables
 *     (terminales, aislado, activeDot), solo se pierden los puntos de mes
 *     "de relleno".
 *   - Recharts v3 `Line` no expone `onMouseEnter`/`onMouseLeave` sobre el trazo
 *     (sí lo hacen `Bar`/`Scatter`/`Funnel`). El disparador "hover sobre la línea"
 *     se implementa vía los puntos (`dot`/`activeDot`) en vez de sobre el `path`.
 *   - `type="linear"` (no monotone, no step): un aumento se lee como escalón.
 *   - `isAnimationActive={false}` en TODAS las `Line`: ver el historial de este
 *     comentario en versiones previas del archivo — la animación de "draw" de
 *     Recharts quedaba congelada a mitad de camino al cambiar de tab sobre un
 *     LineChart ya montado. Se desactivó la animación de entrada para esta
 *     card en vez de arriesgar otro fix parcial.
 */

import { useState, useEffect, useRef, useMemo, useId, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  X,
  AlertTriangle,
  Pencil,
  RefreshCw,
  Eye,
  EyeOff,
  CornerDownRight,
  Repeat,
  ChevronDown,
  Check,
  Info,
  ArrowUp,
} from "lucide-react";
import { useFixedEvolution } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
import { ChartContainer, CHART_END_LABEL_MARGIN } from "@/components/ui/chart";
import { CardCurrencySelect } from "@/components/ui/card-currency-select";
import { useListboxPosition, useListboxDismiss, VIEWPORT_MARGIN } from "@/hooks/use-listbox-popover";
import { assignFixedEvolutionColors, anchorFixedEvolutionColor } from "@/lib/fixed-evolution-colors";
import { FREQUENCY_LABEL } from "@/lib/movements";
import { formatCurrency, CURRENCY_SYMBOLS, getLocalTodayString, formatMonthShort, nextMonth } from "@/lib/format";
import type { FixedEvolutionLine, FixedEvolutionMonthPoint, FixedEvolutionExcludedLine, FixedEvolutionRangeMonths } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton";

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTH_LABELS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CHART_PANEL_ID = "fixed-evolution-chart-panel";

type FixedMode = "amounts" | "variation";
export type EffectiveMode = "amounts" | "nominal" | "adjusted";

function getEffectiveMode(mode: FixedMode, adjusted: boolean): EffectiveMode {
  if (mode === "amounts") return "amounts";
  return adjusted ? "adjusted" : "nominal";
}

function getPointValue(point: FixedEvolutionMonthPoint, mode: EffectiveMode): number | null {
  if (mode === "amounts") return point.amountCents;
  if (mode === "nominal") return point.nominalPct;
  return point.adjustedPct;
}

/** Las 8 opciones del selector de rango (docs/design.md §9), en este orden. */
const RANGE_OPTIONS: ReadonlyArray<{ value: FixedEvolutionRangeMonths; label: string }> = [
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 9, label: "9 meses" },
  { value: 12, label: "1 año" },
  { value: 24, label: "2 años" },
  { value: 36, label: "3 años" },
  { value: 48, label: "4 años" },
  { value: 60, label: "5 años" },
];
/** Índice a partir del cual va el divisor --hair (entre "9 meses" y "1 año"). */
const RANGE_DIVIDER_INDEX = 3;

/**
 * Margen del `<LineChart>` del canvas — único lugar donde vive, para que el
 * cálculo de `slot` (densidad de puntos, más abajo) nunca se desincronice del
 * ancho real reservado a los costados del área de trazado. `right` usa el
 * valor compartido de `CHART_END_LABEL_MARGIN` (evita que el rótulo final del
 * eje X, con año en segunda línea, se corte contra el borde del SVG — bug de
 * QA visual, Ola 6).
 */
const LINE_CHART_MARGIN = { top: 8, right: CHART_END_LABEL_MARGIN, bottom: 0, left: 4 } as const;

const DEFAULT_RANGE_MONTHS: FixedEvolutionRangeMonths = 36;

/** Alto fijo del canvas en la variante acotada (docs/design.md §15). */
const SCOPED_CHART_HEIGHT = 240;

/** Glifo de dirección "ingreso" de listas y tooltip (docs/design.md §3.1): ArrowUp 11px `--income-ink`, stroke 2.2. */
function IncomeGlyph() {
  return (
    <ArrowUp
      size={11}
      strokeWidth={2.2}
      aria-label="Ingreso"
      role="img"
      className="shrink-0 text-income-ink"
    />
  );
}

// ─── Hook: prefers-reduced-motion ─────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ─── Helpers de mes ("YYYY-MM" → rótulos) ────────────────────────────────────

function monthNumOf(month: string): number {
  return Number(month.split("-")[1]);
}
function yearOf(month: string): number {
  return Number(month.split("-")[0]);
}
/** "2026-03" → "Mar" */
function shortMonthLabel(month: string): string {
  return MONTH_LABELS_SHORT[monthNumOf(month) - 1] ?? month;
}
/** "2026-03" → "Marzo" */
function fullMonthLabel(month: string): string {
  return MONTH_LABELS_FULL[monthNumOf(month) - 1] ?? month;
}

/** Construye la grilla temporal del rango efectivo: `rangeMonths` meses corridos desde `startMonth`. */
function buildMonthsList(startMonth: string, rangeMonths: number): string[] {
  const result: string[] = [];
  let m = startMonth;
  for (let i = 0; i < rangeMonths; i++) {
    result.push(m);
    if (i < rangeMonths - 1) m = nextMonth(m);
  }
  return result;
}

// ─── Cadencia de rótulos del eje X (docs/design.md §2) ───────────────────────

/** Paso de la cadencia según el largo del rango y el ancho de contenido. */
export function getAxisTickStep(positions: number, wide: boolean): number {
  if (positions <= 6) return 1;
  if (positions <= 12) return wide ? 1 : 2;
  if (positions <= 24) return wide ? 2 : 3;
  if (positions <= 36) return wide ? 3 : 6;
  return wide ? 6 : 12;
}

export interface AxisLabeling {
  /** Meses ("YYYY-MM") que llevan rótulo de mes. */
  labeled: Set<string>;
  /** Meses que además llevan la segunda línea con el año. */
  withYear: Set<string>;
}

/**
 * Calcula qué posiciones del eje X llevan rótulo (cadencia anclada a enero,
 * §2) y cuáles de esas llevan además el año en una segunda línea (enero,
 * primera y última posición).
 */
export function computeAxisLabeling(monthsList: readonly string[], wide: boolean): AxisLabeling {
  const n = monthsList.length;
  const labeled = new Set<string>();
  const withYear = new Set<string>();
  if (n === 0) return { labeled, withYear };

  const step = getAxisTickStep(n, wide);
  const cadenceIdx: number[] = [];
  monthsList.forEach((m, i) => {
    if ((monthNumOf(m) - 1) % step === 0) cadenceIdx.push(i);
  });

  cadenceIdx.forEach((i) => {
    if (i === 0 || i === n - 1) return; // los bordes se agregan aparte, siempre
    if (i < step) return; // demasiado cerca del borde izquierdo: se suprime
    if (n - 1 - i < step) return; // demasiado cerca del borde derecho: se suprime
    labeled.add(monthsList[i]!);
  });
  labeled.add(monthsList[0]!);
  labeled.add(monthsList[n - 1]!);

  monthsList.forEach((m) => {
    if (labeled.has(m) && monthNumOf(m) === 1) withYear.add(m);
  });
  withYear.add(monthsList[0]!);
  withYear.add(monthsList[n - 1]!);

  return { labeled, withYear };
}

/** Eneros interiores (excluida la posición 0) — frontera de año, docs/design.md §2. */
function computeInteriorJanuaries(monthsList: readonly string[]): string[] {
  return monthsList.filter((m, i) => i > 0 && monthNumOf(m) === 1);
}

/**
 * Ancho disponible por posición de mes (`slot`, docs/design.md §4.B) a partir
 * del ancho medido en vivo del panel del canvas. Descuenta el ancho del eje Y
 * y el margen horizontal REAL del `<LineChart>` (`LINE_CHART_MARGIN` — debe
 * mantenerse en sync con el `margin` pasado al chart; ver el gotcha del bug de
 * QA visual de Ola 6 en `CHART_END_LABEL_MARGIN`). `containerWidth <= 0` o sin
 * meses → `0` (densidad mínima segura, nunca de más — ver docstring del
 * componente).
 */
export function computePlotSlot(containerWidth: number, monthsCount: number, yAxisWidth: number): number {
  if (monthsCount <= 0 || containerWidth <= 0) return 0;
  return Math.max(0, containerWidth - LINE_CHART_MARGIN.left - LINE_CHART_MARGIN.right - yAxisWidth) / monthsCount;
}

// ─── Densidad de puntos (docs/design.md §4) ──────────────────────────────────

export interface DotSpec {
  r: number;
  ring: number;
}

/**
 * Especificación visual de un punto de mes según densidad (`slot`), si es
 * terminal de vigencia, punto aislado o pertenece a la línea destacada.
 * `null` = no se dibuja punto (docs/design.md §4.B).
 */
export function getFixedEvolutionDotSpec(params: {
  isExtreme: boolean;
  isIsolated: boolean;
  isHighlighted: boolean;
  slot: number;
}): DotSpec | null {
  const { isExtreme, isIsolated, isHighlighted, slot } = params;
  // Línea destacada: recupera TODOS sus puntos mientras slot >= 6px.
  if (isHighlighted && slot >= 6) {
    return { r: 2.5, ring: 1.5 };
  }
  // Terminales de vigencia — irrenunciables a cualquier densidad.
  if (isExtreme) {
    return slot < 12 ? { r: 2.5, ring: 1 } : { r: 3, ring: 1.5 };
  }
  // Punto aislado — irrenunciable a cualquier densidad.
  if (isIsolated) {
    return { r: 2, ring: 0 };
  }
  if (slot >= 26) return { r: 2, ring: 0 };
  if (slot >= 12) return { r: 1.5, ring: 0 };
  return null;
}

// ─── Tramos de puente atenuado (docs/design.md §4.A) ─────────────────────────

export interface GapRun {
  /** Índice del último punto real ANTES del hueco (flanco izquierdo). */
  fromIdx: number;
  /** Índice del primer punto real DESPUÉS del hueco (flanco derecho). */
  toIdx: number;
}

/**
 * Tramos de hueco INTERNO de una línea: corridas de `null` entre dos puntos
 * reales, acotadas al rango [primer punto real, último punto real] — nunca
 * antes del alta ni después de la baja (fuera de ese rango no hay línea, no
 * hay puente). Cada tramo se puentea con su propia `<Line>` (ver gotcha en el
 * header del archivo).
 */
export function computeGapRuns(values: ReadonlyArray<number | null>): GapRun[] {
  const runs: GapRun[] = [];
  let firstReal = -1;
  let lastReal = -1;
  values.forEach((v, i) => {
    if (v !== null) {
      if (firstReal === -1) firstReal = i;
      lastReal = i;
    }
  });
  if (firstReal === -1) return runs;

  let idx = firstReal;
  while (idx < lastReal) {
    if (values[idx] !== null) {
      let j = idx + 1;
      while (j <= lastReal && values[j] === null) j++;
      if (j > idx + 1 && j <= lastReal) {
        runs.push({ fromIdx: idx, toIdx: j });
      }
      idx = j;
    } else {
      idx++;
    }
  }
  return runs;
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

/** +8,3% / −2,1% / 0% (U+2212 minus, coma es-AR). */
function formatPct(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return "0%";
}

/** Formato del eje Y de montos: $0, $50k, $120k, $2,5M (coma es-AR). */
function makeAmountTickFormatter(currency: string): (valueCents: number) => string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  return function formatTick(valueCents: number): string {
    const pesos = valueCents / 100;
    if (pesos === 0) return `${sym}0`;
    if (pesos >= 1_000_000) {
      const m = pesos / 1_000_000;
      const label = m % 1 === 0 ? String(m) : m.toFixed(1).replace(".", ",");
      return `${sym}${label}M`;
    }
    if (pesos >= 1_000) {
      const k = pesos / 1_000;
      const label = k % 1 === 0 ? String(k) : k.toFixed(1).replace(".", ",");
      return `${sym}${label}k`;
    }
    return `${sym}${pesos}`;
  };
}

/** Motivo del hueco (docs/design.md §4) — copy único por causa, sin condicionales. */
export function getGapMotive(
  point: FixedEvolutionMonthPoint,
  mode: EffectiveMode,
  line: FixedEvolutionLine,
): string {
  if (point.reason === "frequency") {
    return `No corresponde este mes — ${FREQUENCY_LABEL[line.frequency] ?? "mensual"}.`;
  }
  if (point.reason === "skipped") return "Mes anulado.";
  if (point.reason === "beforeStart") {
    return `Todavía no arrancaba — desde ${formatMonthShort(line.startMonth)}.`;
  }
  if (point.reason === "afterEnd") {
    return line.endMonth
      ? `Dado de baja — hasta ${formatMonthShort(line.endMonth)}.`
      : "Dado de baja.";
  }
  if (point.reason === "resultedIncome") return "Este mes resultó ingreso.";
  // reason === null: en modos de variación, puede faltar el cómputo aunque hubo monto.
  if (mode === "nominal") return "Sin variación computable — no hay un pago anterior con el que comparar.";
  if (mode === "adjusted") {
    if (point.nominalPct === null) return "Sin variación computable — no hay un pago anterior con el que comparar.";
    return "Sin ajuste por inflación — falta el dato de algún mes desde el pago anterior.";
  }
  return "Sin dato este mes.";
}

/** Primer/último índice con valor no nulo. */
function getExtremes(values: ReadonlyArray<number | null>): { first: number; last: number } {
  let first = -1;
  let last = -1;
  values.forEach((v, i) => {
    if (v !== null) {
      if (first === -1) first = i;
      last = i;
    }
  });
  return { first, last };
}

/** Punto aislado: tiene dato y ninguno de sus dos vecinos (dentro del array) tiene dato. */
function isIsolatedPoint(values: ReadonlyArray<number | null>, index: number): boolean {
  if (values[index] === null || values[index] === undefined) return false;
  const prevHas = index > 0 && values[index - 1] !== null && values[index - 1] !== undefined;
  const nextHas = index < values.length - 1 && values[index + 1] !== null && values[index + 1] !== undefined;
  return !prevHas && !nextHas;
}

// ─── Swatch (cuadrado pleno/hueco o mini-línea dasheada) ─────────────────────

interface SwatchProps {
  color: string;
  dashed: boolean;
  size?: number;
  hollow?: boolean;
  dimmedDash?: boolean;
}

function Swatch({ color, dashed, size = 8, hollow = false, dimmedDash = false }: SwatchProps) {
  if (dashed) {
    return (
      <span aria-hidden="true" className="shrink-0 inline-flex items-center" style={{ width: 14, height: Math.max(size, 8) }}>
        <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
          <line x1="0" y1="1" x2="14" y2="1" stroke={color} strokeWidth="2" strokeDasharray="6 4" opacity={dimmedDash ? 0.45 : 1} />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-[3px]"
      style={{
        width: size,
        height: size,
        ...(hollow
          ? { background: "var(--panel)", border: `1.5px solid ${color}` }
          : { background: color }),
      }}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FixedEvolutionSkeleton({ height }: { height: number }) {
  return (
    <div role="status" aria-label="Cargando reporte">
      <SkeletonBlock height={height} radius="ctl" />
      <div className="mt-[14px] flex flex-wrap gap-[10px]">
        {[130, 100, 150, 90, 120].map((w, i) => (
          <SkeletonLine key={i} height={26} width={w} />
        ))}
      </div>
      <div className="mt-[8px] pt-[8px]" style={{ borderTop: "1px solid var(--hair)" }}>
        <SkeletonLine height={24} width={84} />
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

function FixedEvolutionError({
  onRetry,
  message = "No se pudo cargar el reporte.",
  height,
}: {
  onRetry: () => void;
  message?: string;
  /** Variante acotada: el estado se centra en el área fija del canvas (240px). */
  height?: number;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", height === undefined && "py-16")}
      style={height === undefined ? undefined : { height }}
      role="alert"
    >
      <AlertTriangle size={20} aria-hidden="true" className="text-warning-ink" />
      <p className="text-[14px] text-ink-2">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-ctl border border-line bg-panel px-3 py-[6px] text-[13px] font-semibold text-ink-2 shadow-[var(--shadow-sm)] transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
      >
        Reintentar
      </button>
    </div>
  );
}

// ─── ViewTabs — Montos / Variación ─────────────────────────────────────────────

interface ViewTabsProps {
  value: FixedMode;
  onChange: (v: FixedMode) => void;
}

const MODE_TABS: ReadonlyArray<{ label: string; id: string; val: FixedMode }> = [
  { label: "Montos", val: "amounts", id: "tab-fe-montos" },
  { label: "Variación", val: "variation", id: "tab-fe-variacion" },
];

function ViewTabs({ value, onChange }: ViewTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const reducedMotionTabs = useReducedMotion();

  const selectedIndex = MODE_TABS.findIndex((t) => t.val === value);

  useEffect(() => {
    const btn = tabRefs.current[selectedIndex];
    if (!btn) return;
    setUnderline({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = MODE_TABS[(idx + 1) % MODE_TABS.length];
      if (next) onChange(next.val);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = MODE_TABS[(idx - 1 + MODE_TABS.length) % MODE_TABS.length];
      if (prev) onChange(prev.val);
    }
  }

  return (
    <div role="tablist" aria-label="Modo de visualización" className="relative flex items-end gap-[18px] pb-[2px]">
      {underline && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 h-[2px] bg-ink",
            reducedMotionTabs ? "" : "transition-[left,width] duration-[180ms] ease-out",
          )}
          style={{ left: underline.left, width: underline.width }}
        />
      )}
      {MODE_TABS.map((tab, i) => {
        const isSelected = tab.val === value;
        return (
          <button
            key={tab.id}
            id={tab.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={CHART_PANEL_ID}
            onClick={() => onChange(tab.val)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              "relative py-[6px] text-[13px] font-semibold leading-none",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "transition-colors duration-[140ms]",
              isSelected ? "text-ink" : "text-muted hover:text-ink-2 hover:shadow-[inset_0_-2px_0_var(--line-strong)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Chip "Ajustada por inflación" — deshabilitado con motivo en Montos ──────

interface AdjustedChipProps {
  pressed: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function AdjustedChip({ pressed, disabled, onToggle }: AdjustedChipProps) {
  const motiveId = useId();
  const motive = "El ajuste por inflación solo aplica a la variación.";
  const isElevated = !disabled && pressed;

  return (
    <>
      <button
        type="button"
        aria-pressed={pressed}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled ? motiveId : undefined}
        title={disabled ? motive : undefined}
        onClick={() => {
          if (disabled) return;
          onToggle();
        }}
        className={cn(
          "inline-flex items-center px-[10px] py-[5px] rounded-[7px]",
          "text-[12.5px] font-semibold select-none",
          "transition-colors duration-[140ms]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          disabled
            ? "bg-panel-2 border border-line text-muted opacity-45 cursor-default"
            : isElevated
              ? "bg-panel border border-line-strong shadow-[var(--shadow-sm)] text-ink active:bg-panel-3"
              : "bg-panel-2 border border-line text-muted hover:text-ink-2 hover:border-line-strong active:bg-panel-3",
        )}
      >
        Ajustada por inflación
      </button>
      {disabled && (
        <span id={motiveId} className="sr-only">
          {motive}
        </span>
      )}
    </>
  );
}

// ─── RangeSelect — chip-dropdown de rango (docs/design.md §9) ────────────────

interface RangeSelectProps {
  value: FixedEvolutionRangeMonths;
  onChange: (v: FixedEvolutionRangeMonths) => void;
}

const RANGE_INTRINSIC_MAX_HEIGHT = 260;

function RangeSelect({ value, onChange }: RangeSelectProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(() => RANGE_OPTIONS.findIndex((o) => o.value === value));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);
  useListboxDismiss(open, close, triggerRef, panelRef);
  const pos = useListboxPosition(open, triggerRef, panelRef, RANGE_INTRINSIC_MAX_HEIGHT);

  // El panel (minWidth 132) puede ser más ancho que el disparador, y el hook
  // clampea con el ancho del disparador: si no entra alineado a la izquierda,
  // se alinea al borde derecho del disparador, siempre dentro del margen.
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!open || !mounted || !panelRef.current || !triggerRef.current) {
      setPanelLeft(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current.getBoundingClientRect().width;
    const vw = window.innerWidth;
    const fits = rect.left + panelWidth <= vw - VIEWPORT_MARGIN;
    const left = fits ? rect.left : rect.right - panelWidth;
    setPanelLeft(Math.max(VIEWPORT_MARGIN, Math.min(left, vw - panelWidth - VIEWPORT_MARGIN)));
  }, [open, mounted, pos]);

  useEffect(() => {
    if (open) setFocusedIdx(RANGE_OPTIONS.findIndex((o) => o.value === value));
  }, [open, value]);

  function selectOption(idx: number) {
    const opt = RANGE_OPTIONS[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => (i + 1) % RANGE_OPTIONS.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => (i - 1 + RANGE_OPTIONS.length) % RANGE_OPTIONS.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectOption(focusedIdx);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusedIdx]);

  const selectedLabel = RANGE_OPTIONS.find((o) => o.value === value)?.label ?? "3 años";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Rango del reporte"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-[6px] px-[10px] py-[5px]",
          "rounded-ctl border bg-panel shadow-[var(--shadow-sm)] cursor-pointer",
          "transition-colors duration-[140ms]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          open ? "border-line-strong" : "border-line hover:border-line-strong",
        )}
      >
        <span className={cn("text-[12.5px] font-semibold", open ? "text-ink" : "text-ink-2")}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform duration-[140ms]", open ? "rotate-180 text-muted" : "text-faint")}
        />
      </button>

      {mounted && open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Rango del reporte"
            className="animate-modal-pop"
            style={{
              position: "fixed",
              top: pos.top,
              left: panelLeft ?? pos.left,
              minWidth: 132,
              zIndex: 80,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-ctl)",
              boxShadow: "var(--shadow-lg)",
              padding: "4px",
            }}
          >
            {RANGE_OPTIONS.map((opt, idx) => {
              const isSelected = opt.value === value;
              return (
                <div key={opt.value}>
                  {idx === RANGE_DIVIDER_INDEX && (
                    <div className="my-[4px]" style={{ borderTop: "1px solid var(--hair)" }} />
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(idx)}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    className={cn(
                      "flex w-full items-center justify-between gap-[8px]",
                      "px-[10px] py-[6px] rounded-[7px] cursor-pointer text-[12.5px] font-semibold",
                      "transition-colors duration-[140ms]",
                      isSelected ? "text-ink" : "text-ink-2",
                      idx === focusedIdx ? "bg-panel-2" : "hover:bg-panel-2",
                    )}
                  >
                    {opt.label}
                    {isSelected ? (
                      <Check size={14} aria-hidden="true" className="shrink-0 text-ink-2" />
                    ) : (
                      <span className="w-[14px] shrink-0" aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── RemoveConfirmPopover ─────────────────────────────────────────────────────

interface RemoveConfirmPopoverProps {
  onConfirm: () => void;
  onCancel: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function RemoveConfirmPopover({ onConfirm, onCancel, anchorRef }: RemoveConfirmPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onCancel, anchorRef]);

  if (!mounted) return null;

  const content = (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[220px] rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] p-[12px_14px] animate-modal-pop"
      style={{ top: position.top, right: position.right }}
      role="dialog"
      aria-label="Confirmar quitar reporte"
    >
      <p className="text-[13px] text-ink mb-3">¿Quitar este reporte?</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-ctl border border-expense bg-expense-soft px-3 py-[6px] text-[13px] font-semibold text-expense-ink transition-colors duration-[140ms] hover:bg-expense hover:text-white focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]"
        >
          Quitar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-ctl border border-line bg-panel px-3 py-[6px] text-[13px] font-semibold text-ink-2 transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── EditableTitle ────────────────────────────────────────────────────────────

interface EditableTitleProps {
  titleProp: string | undefined;
  titlePlaceholder: string;
  displayTitle: string;
  isEditing: boolean;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onEditingValueChange: (v: string) => void;
  canEdit: boolean;
}

function EditableTitle({
  titleProp, titlePlaceholder, displayTitle, isEditing, editingValue,
  inputRef, onEdit, onCommit, onCancel, onEditingValueChange, canEdit,
}: EditableTitleProps) {
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        maxLength={60}
        value={editingValue}
        placeholder={titlePlaceholder}
        onChange={(e) => onEditingValueChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        aria-label="Título del reporte"
        className={cn(
          "text-[16px] font-semibold leading-tight text-ink",
          "bg-panel border border-[var(--line-strong)] rounded-[var(--r-ctl,10px)]",
          "px-[8px] py-[3px]",
          "min-w-0 flex-1",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          "placeholder:text-[var(--faint)]",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={canEdit ? onEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onEdit(); }
      }}
      aria-label={canEdit ? "Editar título del reporte" : undefined}
      disabled={!canEdit}
      className={cn(
        "group/title flex items-center gap-[6px] min-w-0",
        canEdit ? "cursor-text" : "cursor-default",
        "bg-transparent border-0 p-0 text-left",
        canEdit && "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:rounded-[var(--r-ctl,10px)]",
      )}
    >
      <span
        title={displayTitle}
        className={cn(
          "block text-[16px] font-semibold leading-tight truncate",
          titleProp ? "text-ink" : "text-[var(--faint)]",
        )}
      >
        {displayTitle}
      </span>
      {canEdit && (
        <Pencil
          size={14}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted",
            "opacity-0 transition-opacity duration-[140ms]",
            "group-hover/title:opacity-100 group-focus-visible/title:opacity-100",
            "motion-reduce:transition-none",
          )}
        />
      )}
    </button>
  );
}

// ─── ExcludedTrigger + ExcludedPopover (docs/design.md §8.1) ─────────────────

interface ExcludedTriggerProps {
  count: number;
  open: boolean;
  onClick: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function ExcludedTrigger({ count, open, onClick, triggerRef }: ExcludedTriggerProps) {
  const label = `${count} fijos con una sola aparición en el rango`;
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex items-center gap-[5px] px-[8px] py-[4px] rounded-[7px] cursor-pointer transition-colors duration-[140ms] bg-panel-2 hover:bg-panel-3 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
    >
      <Info size={13} aria-hidden="true" className="shrink-0 text-muted" />
      <span className="text-[12px] font-semibold select-none text-muted">
        <span className="mono">{count}</span> sin evolución
      </span>
    </button>
  );
}

interface ExcludedPopoverProps {
  items: FixedEvolutionExcludedLine[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function ExcludedPopover({ items, anchorRef, onClose }: ExcludedPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const calcPosition = useCallback((panelHeight: number) => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const gap = 6;
    const margin = 12;
    const assumedWidth = 340;

    const espacioAbajo = vh - rect.bottom - margin;
    const cabeAbajo = panelHeight + gap <= espacioAbajo;
    const top = cabeAbajo
      ? rect.bottom + gap
      : Math.max(margin, rect.top - panelHeight - gap);
    const left = Math.max(margin, Math.min(rect.left, vw - assumedWidth - margin));
    setPosition({ top, left });
  }, [anchorRef]);

  useEffect(() => { calcPosition(240); }, [calcPosition]);
  useEffect(() => {
    if (!popoverRef.current) return;
    const h = popoverRef.current.getBoundingClientRect().height;
    if (h > 0) calcPosition(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose, anchorRef]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setHasOverflow(el.scrollHeight > el.clientHeight);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  if (!mounted) return null;

  const content = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Fijos sin evolución en el rango"
      className="fixed z-50 rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] p-[4px] animate-modal-pop"
      style={{
        top: position.top,
        left: position.left,
        minWidth: 260,
        maxWidth: "min(340px, calc(100vw - 32px))",
      }}
    >
      <div className="px-[8px] pt-[6px] pb-[8px]">
        <p className="text-[12px] font-semibold text-ink">Sin evolución en el rango</p>
        <p className="text-[11.5px] text-faint">Con menos de dos apariciones no hay evolución que dibujar.</p>
      </div>
      <div style={{ borderTop: "1px solid var(--hair)" }} />
      <div
        ref={listRef}
        role="list"
        data-overflow={hasOverflow ? "true" : "false"}
        className="max-h-[240px] overflow-y-auto overflow-x-hidden legend-scroll-region"
      >
        {items.map((item) => {
          const label = item.description ?? "Sin descripción";
          return (
            <div key={item.chainId} role="listitem" className="flex items-start gap-[8px] px-[8px] py-[6px] cursor-default">
              <div className="min-w-0">
                <p
                  title={label}
                  className={cn(
                    "flex max-w-full items-center gap-[4px] text-[12.5px] font-medium",
                    item.description ? "text-ink-2" : "text-muted",
                  )}
                  style={{ maxWidth: 180 }}
                >
                  {item.isCalculated && (
                    <CornerDownRight size={11} aria-hidden="true" className="shrink-0 text-muted" />
                  )}
                  {item.type === "INCOME" && <IncomeGlyph />}
                  <span className="truncate">{label}</span>
                </p>
                <p data-testid="excluded-subline" className="flex items-center gap-[5px] text-[11.5px] text-faint">
                  <span
                    className="h-[6px] w-[6px] rounded-full shrink-0"
                    style={{ background: item.categoryColor }}
                    aria-hidden="true"
                  />
                  {item.categoryName} · desde {formatMonthShort(item.startMonth)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── CardControls — cluster derecho de la cabecera ────────────────────────────

interface CardControlsProps {
  rangeMonths: FixedEvolutionRangeMonths;
  onRangeMonthsChange: (v: FixedEvolutionRangeMonths) => void;
  clippedNote: string | null;
  onCurrencyChange: (c: CurrencyCode) => void;
  effectiveCurrency: CurrencyCode;
  removable: boolean;
  removeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onRemoveOpen: () => void;
  onRefresh: () => void;
  isFetching: boolean;
}

function CardControls({
  rangeMonths, onRangeMonthsChange, clippedNote, onCurrencyChange,
  effectiveCurrency, removable, removeButtonRef, onRemoveOpen, onRefresh, isFetching,
}: CardControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <RangeSelect value={rangeMonths} onChange={onRangeMonthsChange} />
      {clippedNote && (
        <span className="text-[11.5px] text-faint whitespace-nowrap">{clippedNote}</span>
      )}
      <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
      <CardCurrencySelect value={effectiveCurrency} onChange={onCurrencyChange} />
      <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Actualizar reporte"
        aria-busy={isFetching}
        className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        <RefreshCw size={16} aria-hidden="true" className={cn(isFetching && "animate-spin motion-reduce:animate-none")} />
      </button>
      {removable && (
        <button
          ref={removeButtonRef}
          type="button"
          onClick={onRemoveOpen}
          aria-label="Quitar reporte"
          className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── Tooltip custom (dos contenidos: modo mes / modo línea) ──────────────────

interface LineMeta {
  chainId: string;
  color: string;
  isCalculated: boolean;
  /** Dirección (§3.1). Ausente/`EXPENSE` = gasto. */
  type: "EXPENSE" | "INCOME";
  description: string | null;
  categoryName: string;
  categoryColor: string;
  originDescription: string | null;
  frequency: number;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string | number;
  /** Variante acotada (§15): siempre modo línea, sin encabezado de identidad ni fila Frecuencia. */
  scoped?: boolean;
  mode: EffectiveMode;
  currency: CurrencyCode;
  highlightedId: string | null;
  /** Universo visible (seleccionado), en orden canónico (gasto del rango DESC). */
  visibleMeta: LineMeta[];
  /** chainId -> valores alineados a `monthsList`. */
  valuesByChain: Map<string, ReadonlyArray<number | null>>;
  /** chainId -> puntos alineados a `monthsList` (para resolver el motivo del hueco). */
  pointsByChain: Map<string, ReadonlyArray<FixedEvolutionMonthPoint | null>>;
  /** chainId -> línea completa. */
  lineByChain: Map<string, FixedEvolutionLine>;
  monthsList: readonly string[];
}

function formatDominantValue(value: number, mode: EffectiveMode, currency: CurrencyCode): string {
  if (mode === "amounts") return formatCurrency(value, currency);
  return formatPct(value);
}

/** Color por tipo de la cifra de dinero (§3.1): solo en Montos; en variación siempre `--ink`. */
function dominantValueColorClass(type: "EXPENSE" | "INCOME", mode: EffectiveMode): string {
  return mode === "amounts" && type === "INCOME" ? "text-income-ink" : "text-ink";
}

export function CustomTooltip({
  active, label, scoped = false, mode, currency, highlightedId, visibleMeta, valuesByChain, pointsByChain, lineByChain, monthsList,
}: CustomTooltipProps) {
  if (!active || typeof label !== "string") return null;
  const monthIndex = monthsList.indexOf(label);
  if (monthIndex === -1) return null;
  const monthFull = fullMonthLabel(label);
  const monthShort = shortMonthLabel(label);
  const year = yearOf(label);

  // ── Modo B: línea destacada — la ficha del fijo-mes ──
  if (highlightedId) {
    const meta = visibleMeta.find((m) => m.chainId === highlightedId) ?? null;
    const line = lineByChain.get(highlightedId) ?? null;
    if (!meta || !line) return null;
    const value = valuesByChain.get(highlightedId)?.[monthIndex] ?? null;
    const point = pointsByChain.get(highlightedId)?.[monthIndex] ?? null;

    const isIncome = meta.type === "INCOME";

    // ── Variante acotada (§15): micro-rótulo del mes + cifra (o "—" + motivo). Sin
    //    encabezado de identidad ni fila Frecuencia; min-width 160px. ──
    if (scoped) {
      return (
        <div
          role="tooltip"
          className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
          style={{ boxShadow: "var(--shadow-lg)", minWidth: "160px", maxWidth: "320px" }}
        >
          {value !== null ? (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">{monthShort} {year}</p>
              <p className={cn("mono text-[13px] font-semibold tabular-nums", dominantValueColorClass(meta.type, mode))}>
                {formatDominantValue(value, mode, currency)}
              </p>
            </div>
          ) : (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">{monthShort} {year}</p>
              <p className="mono text-[13px] text-faint">—</p>
              {point && (
                <>
                  <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />
                  <p className="text-[11.5px] font-medium text-ink-2">{getGapMotive(point, mode, line)}</p>
                </>
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <div
        role="tooltip"
        className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
        style={{ boxShadow: "var(--shadow-lg)", minWidth: "220px", maxWidth: "320px" }}
      >
        {/* Encabezado */}
        <div className="flex items-start gap-[7px]">
          <Swatch color={meta.color} dashed={meta.isCalculated} size={10} />
          <div className="min-w-0">
            <p className={cn("text-[12px] font-semibold truncate", meta.description ? "text-ink" : "text-muted")}>
              {meta.description ?? "Sin descripción"}
            </p>
            <p className="text-[11.5px] font-medium text-ink-2 truncate">
              <span
                className="inline-block h-[6px] w-[6px] rounded-full align-middle mr-[5px]"
                style={{ background: meta.categoryColor }}
                aria-hidden="true"
              />
              {meta.categoryName}
              {" · "}
              <span
                className={cn(
                  "inline-flex items-center rounded-[var(--r-chip)] px-[6px] py-[1px] text-[11px] font-semibold",
                  isIncome ? "bg-income-soft text-income-ink" : "bg-expense-soft text-expense-ink",
                )}
              >
                {isIncome ? "Ingreso" : "Gasto"}
              </span>
              {meta.isCalculated && meta.originDescription && (
                <span className="inline-flex items-center gap-[4px] ml-[4px] text-muted">
                  · <CornerDownRight size={12} aria-hidden="true" /> desde <span className="text-ink-2">{meta.originDescription}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />

        {/* Cifra dominante / hueco */}
        {value !== null ? (
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">{monthShort} {year}</p>
            <p className={cn("mono text-[13px] font-semibold", dominantValueColorClass(meta.type, mode))}>
              {formatDominantValue(value, mode, currency)}
            </p>
          </div>
        ) : (
          <p className="mono text-[13px] text-faint">—</p>
        )}

        <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />

        {/* Frecuencia */}
        <div className="flex items-center justify-between gap-[10px]">
          <span className="text-[11.5px] font-medium text-ink-2">Frecuencia</span>
          <span className="inline-flex items-center gap-[5px] text-[11.5px] font-medium text-muted">
            <Repeat size={12} aria-hidden="true" />
            {FREQUENCY_LABEL[line.frequency] ?? "mensual"}
          </span>
        </div>

        {/* Motivo del hueco */}
        {value === null && point && (
          <>
            <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />
            <p className="text-[11.5px] font-medium text-ink-2">{getGapMotive(point, mode, line)}</p>
          </>
        )}
      </div>
    );
  }

  // ── Modo A: sin línea destacada — lectura comparativa del mes ──
  const rows: Array<{ chainId: string; color: string; dashed: boolean; label: string; value: number; type: "EXPENSE" | "INCOME" }> = [];
  for (const meta of visibleMeta) {
    const value = valuesByChain.get(meta.chainId)?.[monthIndex] ?? null;
    if (value === null) continue;
    rows.push({ chainId: meta.chainId, color: meta.color, dashed: meta.isCalculated, label: meta.description ?? "Sin descripción", value, type: meta.type });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.value - a.value);
  const shown = rows.slice(0, 8);
  const more = rows.length - shown.length;

  return (
    <div
      role="tooltip"
      className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
      style={{ boxShadow: "var(--shadow-lg)", minWidth: "220px", maxWidth: "320px" }}
    >
      <p className="mb-[8px] font-semibold text-ink">{monthFull} {year}</p>
      <div className="flex flex-col gap-[5px]">
        {shown.map((row) => (
          <div key={row.chainId} className="flex items-center gap-[7px]">
            <Swatch color={row.color} dashed={row.dashed} size={8} />
            {row.type === "INCOME" && <IncomeGlyph />}
            <span className="flex-1 text-ink-2 truncate">{row.label}</span>
            <span className={cn("mono shrink-0 tabular-nums", dominantValueColorClass(row.type, mode))}>
              {formatDominantValue(row.value, mode, currency)}
            </span>
          </div>
        ))}
        {more > 0 && (
          <p className="text-[11.5px] text-faint">+{more} más</p>
        )}
      </div>
    </div>
  );
}

// ─── Ticks custom del eje X / eje Y ────────────────────────────────────────────

interface MonthTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  labeled: Set<string>;
  withYear: Set<string>;
}

function MonthTick({ x = 0, y = 0, payload, labeled, withYear }: MonthTickProps) {
  if (payload === undefined) return null;
  const month = payload.value;
  if (!labeled.has(month)) return null;
  return (
    <g>
      <text x={x} y={y + 4} textAnchor="middle" style={{ fontFamily: "var(--ui)", fontSize: "12px", fontWeight: 500, fill: "var(--muted)" }}>
        {shortMonthLabel(month)}
      </text>
      {withYear.has(month) && (
        <text
          x={x}
          y={y + 17}
          textAnchor="middle"
          className="mono"
          style={{ fontFamily: "var(--mono)", fontSize: "10.5px", fill: "var(--faint)" }}
        >
          {yearOf(month)}
        </text>
      )}
    </g>
  );
}

interface CustomPctYTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
}

function CustomPctYTick({ x = 0, y = 0, payload }: CustomPctYTickProps) {
  if (payload === undefined) return null;
  return (
    <text x={x} y={y} textAnchor="end" dominantBaseline="middle" style={{ fontFamily: "var(--mono)", fontSize: "11.5px", fill: "var(--muted)" }}>
      {formatPct(payload.value)}
    </text>
  );
}

interface AmountYTickProps extends CustomPctYTickProps {
  formatter: (valueCents: number) => string;
}

/**
 * Tick del eje Y en modo Montos. Se pasa como elemento JSX (`tick={<AmountYTick .../>}`,
 * no como referencia a componente) porque Recharts clona el elemento inyectando
 * x/y/payload — mismo patrón que `CustomYTick` de `inflation-income-card.tsx`. El
 * `formatter` viaja como prop propia (Recharts preserva las props que no sobrescribe).
 */
function AmountYTick({ x = 0, y = 0, payload, formatter }: AmountYTickProps) {
  if (payload === undefined) return null;
  return (
    <text x={x} y={y} textAnchor="end" dominantBaseline="middle" style={{ fontFamily: "var(--mono)", fontSize: "11.5px", fill: "var(--muted)" }}>
      {formatter(payload.value)}
    </text>
  );
}

// ─── Dot / activeDot custom (hueco visible, extremos anillados, hover) ───────

/**
 * Marca de un punto según dirección (docs/design.md §3.1): gasto = círculo de
 * radio `r`; ingreso = cuadrado de lado `2r` (esquinas rectas, sin `rx`), mismo
 * relleno y mismo anillo/borde `--panel`.
 */
export function PointMarker({
  cx, cy, r, fill, ring, income,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  ring: number;
  income: boolean;
}) {
  const stroke = ring > 0 ? "var(--panel)" : "none";
  if (income) {
    return (
      <rect
        data-point-shape="square"
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={ring}
      />
    );
  }
  return <circle data-point-shape="circle" cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={ring} />;
}

function makeDotRenderer(
  chainId: string,
  color: string,
  values: ReadonlyArray<number | null>,
  firstIdx: number,
  lastIdx: number,
  isHighlightedLine: boolean,
  slot: number,
  onHoverChain: (id: string | null) => void,
  income: boolean,
) {
  return function CustomDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props;
    if (cx === undefined || cy === undefined || index === undefined) return <g key={`d-${chainId}-${index}`} />;
    const value = values[index];
    if (value === null || value === undefined) return <g key={`d-${chainId}-${index}`} />;
    const isExtreme = index === firstIdx || index === lastIdx;
    const isIsolated = isIsolatedPoint(values, index);
    const spec = getFixedEvolutionDotSpec({ isExtreme, isIsolated, isHighlighted: isHighlightedLine, slot });
    if (!spec) return <g key={`d-${chainId}-${index}`} />;
    return (
      <g key={`d-${chainId}-${index}`}>
        <PointMarker cx={cx} cy={cy} r={spec.r} fill={color} ring={spec.ring} income={income} />
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => onHoverChain(chainId)}
          onMouseLeave={() => onHoverChain(null)}
        />
      </g>
    );
  };
}

function makeActiveDotRenderer(
  chainId: string,
  color: string,
  onHoverChain: (id: string | null) => void,
  income: boolean,
) {
  return function CustomActiveDot(props: { cx?: number; cy?: number }) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return <g />;
    return (
      <g
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHoverChain(chainId)}
        onMouseLeave={() => onHoverChain(null)}
      >
        <PointMarker cx={cx} cy={cy} r={4} fill={color} ring={2} income={income} />
      </g>
    );
  };
}

// ─── Área del gráfico con responsivo (300px / 220px < --bp-wide) ─────────────

interface ChartResponsiveAreaProps {
  desktopHeight: number;
  children: (height: number, wide: boolean) => React.ReactNode;
}

function ChartResponsiveArea({ desktopHeight, children }: ChartResponsiveAreaProps) {
  return (
    <>
      <div className="@max-wide:hidden" style={{ height: desktopHeight }}>
        {children(desktopHeight, true)}
      </div>
      <div className="@wide:hidden" style={{ height: 220 }}>
        {children(220, false)}
      </div>
    </>
  );
}

// ─── Leyenda-selector de fijos ────────────────────────────────────────────────

interface FixedLegendProps {
  lines: FixedEvolutionLine[];
  colorByChain: Map<string, string>;
  selectedSet: Set<string>;
  valuesByChain: Map<string, ReadonlyArray<number | null>>;
  highlightedId: string | null;
  onToggle: (chainId: string) => void;
  onAllNone: (allOn: boolean) => void;
  onHighlight: (id: string | null) => void;
  excludedCount: number;
  excludedTriggerRef: React.RefObject<HTMLButtonElement | null>;
  excludedOpen: boolean;
  onToggleExcluded: () => void;
  /** Title del ítem "sin trazo en el modo actual" — dos variantes según el chip de ajuste (docs/design.md §8). */
  noTraceTitle: string;
}

function FixedLegend({
  lines, colorByChain, selectedSet, valuesByChain, highlightedId, onToggle, onAllNone, onHighlight,
  excludedCount, excludedTriggerRef, excludedOpen, onToggleExcluded, noTraceTitle,
}: FixedLegendProps) {
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRegionRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setHasOverflow(el.scrollHeight > el.clientHeight);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lines.length]);

  const allVisible = selectedSet.size === lines.length;
  const allNoneLabel = allVisible ? "Ninguna" : "Todas";
  const AllNoneIcon = allVisible ? EyeOff : Eye;

  return (
    <div className="mt-[14px]">
      <div
        ref={scrollRegionRef}
        className="max-h-[112px] overflow-y-auto overflow-x-hidden pr-[2px] legend-scroll-region"
        data-overflow={hasOverflow ? "true" : "false"}
      >
        <div role="group" aria-label="Elegir fijos" className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] -mx-[6px]">
          {lines.map((line) => {
            const color = colorByChain.get(line.chainId) ?? "var(--muted)";
            const isSelected = selectedSet.has(line.chainId);
            const values = valuesByChain.get(line.chainId) ?? [];
            const hasTrace = values.some((v) => v !== null);
            const state: "selected" | "unselected" | "no-trace" = !isSelected ? "unselected" : hasTrace ? "selected" : "no-trace";
            const label = line.description ?? "Sin descripción";
            const isHighlighted = highlightedId === line.chainId;

            return (
              <button
                key={line.chainId}
                type="button"
                aria-pressed={isSelected}
                title={state === "no-trace" ? noTraceTitle : label}
                onClick={() => onToggle(line.chainId)}
                onMouseEnter={() => onHighlight(line.chainId)}
                onMouseLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(line.chainId)}
                onBlur={() => onHighlight(null)}
                className={cn(
                  "group inline-flex items-center gap-[6px] px-[6px] py-[4px] rounded-[7px]",
                  "cursor-pointer transition-[background-color,opacity] duration-[140ms]",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                  isHighlighted ? "bg-panel-2" : "hover:bg-panel-2 active:bg-panel-3",
                  state === "unselected" ? "opacity-70" : "opacity-100",
                )}
              >
                {line.isCalculated ? (
                  <span className="inline-flex items-center gap-[3px] shrink-0">
                    <Swatch color={color} dashed size={11} dimmedDash={state === "unselected"} />
                    <CornerDownRight size={11} aria-hidden="true" className="text-muted" />
                  </span>
                ) : (
                  <Swatch color={color} dashed={false} size={10} hollow={state === "unselected"} />
                )}
                {line.type === "INCOME" && <IncomeGlyph />}
                <span
                  title={label}
                  className={cn(
                    "text-[12.5px] font-medium select-none truncate",
                    state === "unselected" ? "text-muted line-through" : state === "no-trace" ? "text-muted" : "text-ink-2",
                  )}
                  style={{ maxWidth: 180 }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carril fijo del comando */}
      <div className="mt-[8px] pt-[8px] flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--hair)" }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={allVisible ? "Ocultar todos los fijos" : "Mostrar todos los fijos"}
            onClick={() => onAllNone(!allVisible)}
            className="group inline-flex items-center gap-[6px] px-[8px] py-[4px] rounded-[7px] cursor-pointer transition-colors duration-[140ms] bg-panel-2 hover:bg-panel-3 active:bg-panel-3 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <AllNoneIcon size={13} aria-hidden="true" className="shrink-0 text-muted transition-colors duration-[140ms] group-hover:text-ink" />
            <span className="text-[12px] font-semibold select-none text-ink-2 group-hover:text-ink transition-colors duration-[140ms]">
              {allNoneLabel}
            </span>
          </button>
          {excludedCount > 0 && (
            <>
              <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
              <ExcludedTrigger count={excludedCount} open={excludedOpen} onClick={onToggleExcluded} triggerRef={excludedTriggerRef} />
            </>
          )}
        </div>
        <span
          className="mono text-[11.5px] text-muted shrink-0"
          aria-label={`${selectedSet.size} de ${lines.length} fijos seleccionados`}
          title={`${selectedSet.size} de ${lines.length} fijos seleccionados`}
        >
          {selectedSet.size} / {lines.length}
        </span>
      </div>
    </div>
  );
}

// ─── FixedEvolutionCard — Props ───────────────────────────────────────────────

export interface FixedEvolutionCardProps {
  rangeMonths?: FixedEvolutionRangeMonths;
  currency?: CurrencyCode;
  title?: string;
  titlePlaceholder?: string;
  removable?: boolean;
  chartHeight?: number;
  mode?: FixedMode;
  adjusted?: boolean;
  selectedIds?: string[] | null;
  /**
   * Variante acotada a UN fijo (RF-VM-009, docs/design.md §15): se manda como
   * `chainId` al endpoint y la card se renderiza sin chrome de reporte (solo
   * fila de controles con el select de rango + canvas de 240px). `currency`,
   * `title`, `mode`, `adjusted`, `selectedIds`, `chartHeight`, `removable` y
   * los callbacks de título/moneda/modo/selección/quitar se ignoran.
   */
  chainId?: string;
  onRangeMonthsChange?: (rangeMonths: FixedEvolutionRangeMonths) => void;
  onCurrencyChange?: (c: CurrencyCode) => void;
  onTitleChange?: (title: string) => void;
  onRemove?: () => void;
  onModeChange?: (mode: FixedMode) => void;
  onAdjustedChange?: (adjusted: boolean) => void;
  onSelectedIdsChange?: (ids: string[] | null) => void;
}

// ─── FixedEvolutionCard ───────────────────────────────────────────────────────

export function FixedEvolutionCard({
  rangeMonths = DEFAULT_RANGE_MONTHS,
  currency: currencyProp,
  title: titleProp,
  titlePlaceholder = "Reporte",
  removable: removableProp = false,
  chartHeight: chartHeightProp = 300,
  mode: modeProp = "amounts",
  adjusted: adjustedProp = false,
  selectedIds: selectedIdsProp = null,
  chainId: scopedChainId,
  onRangeMonthsChange,
  onCurrencyChange,
  onTitleChange,
  onRemove,
  onModeChange,
  onAdjustedChange,
  onSelectedIdsChange,
}: FixedEvolutionCardProps) {
  const scoped = scopedChainId !== undefined;
  // Variante acotada (§15): Montos, moneda default, todo seleccionado, sin quitar.
  const currency = scoped ? undefined : currencyProp;
  const removable = scoped ? false : removableProp;
  const chartHeight = scoped ? SCOPED_CHART_HEIGHT : chartHeightProp;
  const mode: FixedMode = scoped ? "amounts" : modeProp;
  const adjusted = scoped ? false : adjustedProp;
  const selectedIds = scoped ? null : selectedIdsProp;

  const { defaultCurrency } = useSettings();
  const effectiveCurrency = currency ?? defaultCurrency;
  const today = useMemo(() => getLocalTodayString(), []);

  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useFixedEvolution(rangeMonths, currency, today, scopedChainId);

  // Variante acotada: el skeleton también cubre el cambio de rango (con `keepPreviousData`
  // la data vieja seguiría a la vista mientras llega la nueva).
  const showSkeleton = isLoading || !data || (scoped && isPlaceholderData);
  const showMeasuredArea = !isError && !showSkeleton;

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Excluidos ──────────────────────────────────────────────────────────────
  const [excludedOpen, setExcludedOpen] = useState(false);
  const excludedTriggerRef = useRef<HTMLButtonElement>(null);

  // ── Destacado por hover (efímero, no persiste, no toca la selección) ──────
  const [hoveredId, setHighlightedId] = useState<string | null>(null);

  // ── Medición en vivo del ancho del plot (slot de densidad, §4.B) ──────────
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setContainerWidth(el.clientWidth);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // `showMeasuredArea`: el panel del canvas solo existe tras la carga — hay que
    // (re)enganchar la medición cuando aparece, no solo en el primer mount.
  }, [showMeasuredArea]);

  // ── Edición de título ──────────────────────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  function startTitleEdit() {
    if (!onTitleChange) return;
    setEditingValue(titleProp ?? "");
    setIsEditingTitle(true);
  }
  function commitTitleEdit() {
    if (!isEditingTitle) return;
    setIsEditingTitle(false);
    onTitleChange?.(editingValue.trim());
  }
  function cancelTitleEdit() {
    setIsEditingTitle(false);
    setEditingValue(titleProp ?? "");
  }
  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  const lines = useMemo(() => data?.lines ?? [], [data]);
  const excluded = useMemo(() => {
    const list = data?.excluded ?? [];
    return [...list].sort((a, b) => {
      if (a.startMonth !== b.startMonth) return a.startMonth < b.startMonth ? 1 : -1; // DESC
      const da = a.description ?? "Sin descripción";
      const db = b.description ?? "Sin descripción";
      return da.localeCompare(db, "es-AR");
    });
  }, [data]);

  // Variante acotada: la única línea va SIEMPRE en tratamiento de destacado (§15) y el
  // hover no cambia nada. En /reportes manda el hover.
  const highlightedId = scoped ? (lines[0]?.chainId ?? null) : hoveredId;

  const allChainIds = useMemo(() => lines.map((l) => l.chainId), [lines]);

  const selectedSet = useMemo(() => {
    if (selectedIds === null) return new Set(allChainIds);
    return new Set(selectedIds);
  }, [selectedIds, allChainIds]);

  function handleToggle(chainId: string) {
    const current = selectedIds === null ? allChainIds : selectedIds;
    const isCurrentlyActive = current.includes(chainId);
    let next: string[] | null;
    if (isCurrentlyActive) {
      const remaining = current.filter((id) => id !== chainId);
      const remainingSet = new Set(remaining);
      const equalsUniverse = remaining.length === allChainIds.length && allChainIds.every((id) => remainingSet.has(id));
      next = equalsUniverse ? null : remaining;
    } else {
      const added = [...current, chainId];
      const addedSet = new Set(added);
      const equalsUniverse = added.length === allChainIds.length && allChainIds.every((id) => addedSet.has(id));
      next = equalsUniverse ? null : added;
    }
    onSelectedIdsChange?.(next);
  }

  function handleAllNone(allOn: boolean) {
    onSelectedIdsChange?.(allOn ? null : []);
  }

  const effectiveMode = getEffectiveMode(mode, adjusted);
  const isAmounts = effectiveMode === "amounts";
  const noTraceTitle =
    effectiveMode === "adjusted"
      ? "Sin variación ajustada en el rango — falta el dato de inflación entre sus pagos."
      : "Sin variación computable en el rango — ningún pago de este fijo se pudo comparar con el anterior.";

  // Reportes: `FX[ordinal mod 12]`. Variante acotada (§3 punto 5): color de la
  // categoría re-anclado (una sola línea, sin vecinos que separar).
  const colorByChain = useMemo(
    () =>
      scoped
        ? new Map(lines.map((l) => [l.chainId, anchorFixedEvolutionColor(l.categoryColor)] as const))
        : assignFixedEvolutionColors(lines.map((l) => ({ chainId: l.chainId, ordinal: l.ordinal }))),
    [lines, scoped],
  );

  const lineByChain = useMemo(() => new Map(lines.map((l) => [l.chainId, l])), [lines]);

  // ── Grilla temporal del rango efectivo ────────────────────────────────────
  const monthsList = useMemo(() => {
    if (!data) return [];
    return buildMonthsList(data.startMonth, data.rangeMonths);
  }, [data]);

  // ── Puntos y valores alineados a `monthsList` por cadena ──────────────────
  const pointsByChain = useMemo(() => {
    const map = new Map<string, ReadonlyArray<FixedEvolutionMonthPoint | null>>();
    for (const line of lines) {
      const byMonth = new Map(line.months.map((p) => [p.month, p]));
      map.set(line.chainId, monthsList.map((m) => byMonth.get(m) ?? null));
    }
    return map;
  }, [lines, monthsList]);

  const valuesByChain = useMemo(() => {
    const map = new Map<string, ReadonlyArray<number | null>>();
    for (const line of lines) {
      const points = pointsByChain.get(line.chainId) ?? [];
      map.set(line.chainId, points.map((p) => (p ? getPointValue(p, effectiveMode) : null)));
    }
    return map;
  }, [lines, pointsByChain, effectiveMode]);

  const visibleLines = useMemo(() => lines.filter((l) => selectedSet.has(l.chainId)), [lines, selectedSet]);

  const orderedForPaint = useMemo(() => {
    if (!highlightedId) return visibleLines;
    const rest = visibleLines.filter((l) => l.chainId !== highlightedId);
    const hi = visibleLines.find((l) => l.chainId === highlightedId);
    return hi ? [...rest, hi] : visibleLines;
  }, [visibleLines, highlightedId]);

  const visibleMeta: LineMeta[] = useMemo(
    () =>
      visibleLines.map((l) => ({
        chainId: l.chainId,
        color: colorByChain.get(l.chainId) ?? "var(--muted)",
        isCalculated: l.isCalculated,
        type: l.type === "INCOME" ? "INCOME" : "EXPENSE",
        description: l.description,
        categoryName: l.categoryName,
        categoryColor: l.categoryColor,
        originDescription: l.originDescription,
        frequency: l.frequency,
      })),
    [visibleLines, colorByChain],
  );

  // ── Dominio del eje Y ──────────────────────────────────────────────────────
  const yDomain: [number, number] = useMemo(() => {
    if (isAmounts) {
      let maxVal = 0;
      for (const line of visibleLines) {
        for (const v of valuesByChain.get(line.chainId) ?? []) {
          if (v !== null && v > maxVal) maxVal = v;
        }
      }
      const domainMax = maxVal === 0 ? 10000 : Math.ceil(maxVal * 1.08);
      return [0, domainMax];
    }
    let minVal = 0;
    let maxVal = 0;
    for (const line of visibleLines) {
      for (const v of valuesByChain.get(line.chainId) ?? []) {
        if (v === null) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const pad = 2;
    const dMin = Math.floor(minVal - pad);
    const dMax = Math.ceil(maxVal + pad);
    return [Math.min(dMin, -pad), Math.max(dMax, pad)];
  }, [isAmounts, visibleLines, valuesByChain]);

  // ── Filas del chart (una por mes del rango efectivo) + tramos de puente ──
  const bridgeRunsByChain = useMemo(() => {
    const map = new Map<string, GapRun[]>();
    if (!isAmounts) return map;
    for (const line of visibleLines) {
      const values = valuesByChain.get(line.chainId) ?? [];
      map.set(line.chainId, computeGapRuns(values));
    }
    return map;
  }, [isAmounts, visibleLines, valuesByChain]);

  const chartRows = useMemo(() => {
    return monthsList.map((m, i) => {
      const row: Record<string, unknown> = { month: m };
      for (const line of visibleLines) {
        const values = valuesByChain.get(line.chainId) ?? [];
        row[line.chainId] = values[i] ?? null;
        const runs = bridgeRunsByChain.get(line.chainId) ?? [];
        runs.forEach((run, runIdx) => {
          const key = `${line.chainId}__bridge__${runIdx}`;
          if (i === run.fromIdx) row[key] = values[run.fromIdx] ?? null;
          else if (i === run.toIdx) row[key] = values[run.toIdx] ?? null;
          else if (!(key in row)) row[key] = null;
        });
      }
      return row;
    });
  }, [monthsList, visibleLines, valuesByChain, bridgeRunsByChain]);

  // ── Estados ─────────────────────────────────────────────────────────────────
  const hasData = Boolean(data);
  const isRangeEmpty = hasData && lines.length === 0;
  const isRangeEmptyPure = isRangeEmpty && excluded.length === 0;
  const isRangeEmptyWithExcluded = isRangeEmpty && excluded.length > 0;
  const isNoneSelected = hasData && lines.length > 0 && selectedSet.size === 0;
  const isVariationEmpty =
    !isAmounts &&
    hasData &&
    lines.length > 0 &&
    !isNoneSelected &&
    visibleLines.every((l) => !(valuesByChain.get(l.chainId) ?? []).some((v) => v !== null));

  const displayTitle = titleProp ?? titlePlaceholder;

  const isClipped = hasData && data!.rangeMonths < rangeMonths;
  const clippedNote = isClipped ? `Desde ${formatMonthShort(data!.startMonth)} — es todo tu historial.` : null;

  const interiorJanuaries = useMemo(() => computeInteriorJanuaries(monthsList), [monthsList]);

  const amountTickFormatter = useMemo(() => makeAmountTickFormatter(effectiveCurrency), [effectiveCurrency]);
  const yAxisWidth = isAmounts ? 56 : 44;
  const yAxisTickElement = isAmounts ? <AmountYTick formatter={amountTickFormatter} /> : <CustomPctYTick />;

  const slot = computePlotSlot(containerWidth, monthsList.length, yAxisWidth);

  function renderCanvas(height: number, wide: boolean) {
    const { labeled, withYear } = computeAxisLabeling(monthsList, wide);
    return (
      <ChartContainer height={height}>
        <LineChart data={chartRows} margin={LINE_CHART_MARGIN}>
          <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="var(--hair)" strokeWidth={1} />
          {interiorJanuaries.map((m) => (
            <ReferenceLine key={`year-${m}`} x={m} stroke="var(--hair)" strokeWidth={1} ifOverflow="visible" />
          ))}
          <XAxis
            dataKey="month"
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={<MonthTick labeled={labeled} withYear={withYear} />}
            dy={4}
          />
          <YAxis domain={yDomain} axisLine={false} tickLine={false} tick={yAxisTickElement} width={yAxisWidth} />
          {!isAmounts && <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} strokeDasharray="0" />}
          <Tooltip
            cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
            content={
              <CustomTooltip
                scoped={scoped}
                mode={effectiveMode}
                currency={effectiveCurrency}
                highlightedId={highlightedId}
                visibleMeta={visibleMeta}
                valuesByChain={valuesByChain}
                pointsByChain={pointsByChain}
                lineByChain={lineByChain}
                monthsList={monthsList}
              />
            }
          />
          {/*
            IMPORTANTE: Recharts inspecciona los hijos DIRECTOS de <LineChart>
            para detectar sus componentes (Line/XAxis/YAxis/...) — envolver un
            <Line> en un <g> u otro elemento host lo vuelve invisible para esa
            inspección (no se dibuja). Por eso el puente + la línea plena de
            cada fijo se aplanan con flatMap en un único array de <Line>
            hermanas, igual que el patrón ya vigente de `report-card.tsx`
            (`mergedCategories.map(...)` como hijos directos de <BarChart>).
          */}
          {orderedForPaint.flatMap((line) => {
            const color = colorByChain.get(line.chainId) ?? "var(--muted)";
            const values = valuesByChain.get(line.chainId) ?? [];
            const isHi = highlightedId === line.chainId;
            const isDim = highlightedId !== null && !isHi;
            const { first, last } = getExtremes(values);
            const runs = bridgeRunsByChain.get(line.chainId) ?? [];
            const bridgeOpacity = isDim ? 0.18 : 0.35;
            const bridgeLines = runs.map((_run, runIdx) => (
              <Line
                key={`${line.chainId}-bridge-${runIdx}`}
                type="linear"
                dataKey={`${line.chainId}__bridge__${runIdx}`}
                stroke={color}
                strokeWidth={isHi ? 2.5 : 2}
                strokeOpacity={bridgeOpacity}
                strokeDasharray={line.isCalculated ? "6 4" : undefined}
                connectNulls
                isAnimationActive={false}
                dot={false}
                activeDot={false}
                legendType="none"
              />
            ));
            const mainLine = (
              <Line
                key={line.chainId}
                type="linear"
                dataKey={line.chainId}
                name={line.chainId}
                stroke={color}
                strokeWidth={isHi ? 2.5 : 2}
                strokeOpacity={isDim ? 0.18 : 1}
                strokeDasharray={line.isCalculated ? "6 4" : undefined}
                connectNulls={false}
                isAnimationActive={false}
                dot={
                  isDim
                    ? false
                    : (makeDotRenderer(line.chainId, color, values, first, last, isHi, slot, setHighlightedId, line.type === "INCOME") as unknown as boolean)
                }
                activeDot={
                  isDim
                    ? false
                    : (makeActiveDotRenderer(line.chainId, color, setHighlightedId, line.type === "INCOME") as unknown as boolean)
                }
              />
            );
            // El puente va SIEMPRE antes (por debajo) del trazo pleno de la MISMA línea.
            return [...bridgeLines, mainLine];
          })}
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <div
      className={cn(!scoped && "bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade")}
      aria-label={scoped ? "Evolución del fijo" : displayTitle}
    >
      {scoped ? (
        /* ── Variante acotada (§15): una sola fila de controles con el select de rango ── */
        <div className="mb-[14px] flex items-center justify-end">
          <RangeSelect value={rangeMonths} onChange={(v) => onRangeMonthsChange?.(v)} />
        </div>
      ) : (
        <>
      {/* ── Línea 1: título editable ── */}
      <div className="mb-[8px] flex items-center gap-[6px]">
        <div className="min-w-0">
          <EditableTitle
            titleProp={titleProp}
            titlePlaceholder={titlePlaceholder}
            displayTitle={displayTitle}
            isEditing={isEditingTitle}
            editingValue={editingValue}
            inputRef={titleInputRef}
            onEdit={startTitleEdit}
            onCommit={commitTitleEdit}
            onCancel={cancelTitleEdit}
            onEditingValueChange={setEditingValue}
            canEdit={!!onTitleChange}
          />
        </div>
      </div>

      {/* ── Línea 2: [tabs + chip] izq / [controles] der ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
        <div className="flex flex-wrap items-center gap-[6px]">
          <ViewTabs value={mode} onChange={(v) => onModeChange?.(v)} />
          <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
          <AdjustedChip pressed={adjusted} disabled={isAmounts} onToggle={() => onAdjustedChange?.(!adjusted)} />
        </div>
        <CardControls
          rangeMonths={rangeMonths}
          onRangeMonthsChange={(v) => onRangeMonthsChange?.(v)}
          clippedNote={clippedNote}
          onCurrencyChange={(c) => onCurrencyChange?.(c)}
          effectiveCurrency={effectiveCurrency}
          removable={removable}
          removeButtonRef={removeButtonRef}
          onRemoveOpen={() => setRemoveOpen((o) => !o)}
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>
        </>
      )}

      {/* ── Área del gráfico ── */}
      {isError ? (
        <FixedEvolutionError
          onRetry={() => refetch()}
          message={scoped ? "No se pudo cargar la evolución." : undefined}
          height={scoped ? SCOPED_CHART_HEIGHT : undefined}
        />
      ) : showSkeleton ? (
        scoped ? (
          <div role="status" aria-label="Cargando evolución">
            <SkeletonBlock height={SCOPED_CHART_HEIGHT} radius="ctl" />
          </div>
        ) : (
          <FixedEvolutionSkeleton height={chartHeight} />
        )
      ) : (
        <>
          <div
            id={scoped ? undefined : CHART_PANEL_ID}
            ref={chartAreaRef}
            role={scoped ? undefined : "tabpanel"}
            aria-labelledby={scoped ? undefined : mode === "amounts" ? "tab-fe-montos" : "tab-fe-variacion"}
            className="relative"
          >
            {scoped && isRangeEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                <p className="text-[14px] text-muted">Este fijo no tiene dos meses con monto en el rango.</p>
                {rangeMonths !== 60 && (
                  <p className="text-[12.5px] leading-[1.5] text-faint">Alargá el rango para ver su evolución.</p>
                )}
              </div>
            )}
            {!scoped && isRangeEmptyPure && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                <p className="text-[14px] text-muted">Sin fijos en el rango.</p>
                <p className="text-[12.5px] leading-[1.5] text-muted">Probá un rango más largo.</p>
              </div>
            )}
            {!scoped && isRangeEmptyWithExcluded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                <p className="text-[14px] text-muted">Ningún fijo tiene dos apariciones en el rango.</p>
                <p className="text-[12.5px] leading-[1.5] text-muted">Alargá el rango para ver su evolución.</p>
              </div>
            )}
            {!isRangeEmpty && isNoneSelected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                <p className="text-[14px] text-muted">Ningún fijo seleccionado.</p>
                <p className="text-[12.5px] leading-[1.5] text-muted">Elegí uno en la lista de abajo.</p>
              </div>
            )}
            {!isRangeEmpty && !isNoneSelected && isVariationEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                {adjusted ? (
                  <>
                    <p className="text-[14px] text-muted">Sin variación ajustada en el rango.</p>
                    <p className="text-[12.5px] leading-[1.5] text-muted">Probá sin el ajuste por inflación.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[14px] text-muted">Sin variación computable en el rango.</p>
                    <p className="text-[12.5px] leading-[1.5] text-muted">Faltan datos para comparar cada pago con el anterior.</p>
                  </>
                )}
              </div>
            )}
            {scoped ? (
              // Siempre la columna "amplio" de la cadencia de rótulos (§15): el ancho lo fija el panel del modal.
              renderCanvas(SCOPED_CHART_HEIGHT, true)
            ) : (
              <ChartResponsiveArea desktopHeight={chartHeight}>{(height, wide) => renderCanvas(height, wide)}</ChartResponsiveArea>
            )}
          </div>

          {!scoped && !isRangeEmpty && (
            <FixedLegend
              lines={lines}
              colorByChain={colorByChain}
              selectedSet={selectedSet}
              valuesByChain={valuesByChain}
              highlightedId={highlightedId}
              onToggle={handleToggle}
              onAllNone={handleAllNone}
              onHighlight={setHighlightedId}
              excludedCount={excluded.length}
              excludedTriggerRef={excludedTriggerRef}
              excludedOpen={excludedOpen}
              onToggleExcluded={() => setExcludedOpen((o) => !o)}
              noTraceTitle={noTraceTitle}
            />
          )}

          {/* Carril mínimo cuando el universo tildable está vacío pero hay excluidos (docs/design.md §10). */}
          {!scoped && isRangeEmptyWithExcluded && (
            <div className="mt-[14px] pt-[8px] flex items-center" style={{ borderTop: "1px solid var(--hair)" }}>
              <ExcludedTrigger
                count={excluded.length}
                open={excludedOpen}
                onClick={() => setExcludedOpen((o) => !o)}
                triggerRef={excludedTriggerRef}
              />
            </div>
          )}
        </>
      )}

      {!scoped && excludedOpen && excluded.length > 0 && (
        <ExcludedPopover items={excluded} anchorRef={excludedTriggerRef} onClose={() => setExcludedOpen(false)} />
      )}

      {removeOpen && removable && (
        <RemoveConfirmPopover
          onConfirm={() => { setRemoveOpen(false); onRemove?.(); }}
          onCancel={() => setRemoveOpen(false)}
          anchorRef={removeButtonRef}
        />
      )}
    </div>
  );
}
