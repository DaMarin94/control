"use client";

/**
 * InflationIncomeCard — Card de reporte "Inflación vs Ingresos" (Ola 4, P5).
 *
 * Gráfico de líneas anual (Recharts LineChart) con:
 *   - Serie 1: Inflación (IPC) — `--rate` graphite, sólida 2px
 *   - Serie 2: Var. % ingresos nominal — `--income` sólida 2px
 *   - Serie 3: Var. % ingresos ajustada — `--income` dasheada `6 4` 2px
 *   - Tendencia 1: recta sobre nominal — `--income` op 0.45, punteada `2 3` 1.25px
 *   - Tendencia 2: recta sobre ajustada — `--income` op 0.45, punteada `2 3` 1.25px
 *
 * Eje Y: puntos porcentuales con signo. Baseline en cero marcada.
 * Leyenda: 3 ítems toggle (las 2 tendencias siguen la visibilidad de su serie madre).
 * Tooltip: 3 filas (solo series de dato visibles), valores en mono tabular `tnum`.
 * Cabecera: título editable (P4) + YearStepper + CardCurrencyTrigger + X.
 * Filtro de categorías: chips-toggle (ChartLegend scrollable) debajo del plot.
 *
 * Spec visual: docs/design.md §"Reporte anual 'Inflación vs Ingresos' — gráfico de líneas (Ola 4, P5)".
 *
 * Gotchas:
 *   - connectNulls={false}: los null en meses futuros cortan la línea (no interpola).
 *   - Las tendencias vienen desde `incomeTrend.points` / `incomeAdjTrend.points`; no se recalculan en el front.
 *   - points=null → no se dibuja la tendencia (< 2 puntos con dato).
 *   - El eje Y usa `domain={['dataMin - pad', 'dataMax + pad']}` con pad manual para que la baseline quede visible.
 *   - Cifras: mono tabular `tnum` (IBM Plex Mono por --mono); no se setea fontFeatureSettings en el tick SVG.
 *   - prefers-reduced-motion: isAnimationActive={false}.
 *   - El token `--rate` es nuevo (Ola 4, P5): oklch(0.45 0.03 270) claro / oklch(0.72 0.025 270) oscuro.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useInflationIncome } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
import { useLimits } from "@/hooks/use-limits";
import { computeInflationIncomeMarks } from "@/lib/limits/apply-reports";
import { describeLimitMark, mergeLimitMarks, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { renderSeriesPointMark } from "@/components/limits/limit-mark";
import { ChartContainer, ChartLegend } from "@/components/ui/chart";
import { CardCurrencySelect } from "@/components/ui/card-currency-select";
import type { AnnualInflationIncomeResponse } from "@/types/reports";
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

/** IDs canónicos de las 3 series de dato para el toggle de leyenda. */
const SERIES_IDS = {
  inflation: "inflation",
  income: "income",
  incomeAdj: "incomeAdj",
} as const;

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

// ─── Helpers de formato ───────────────────────────────────────────────────────

/**
 * Formatea un valor en puntos porcentuales con signo y separador coma es-AR.
 * +8,3% / −2,1% / 0%
 */
function formatPct(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`; // U+2212 minus
  return "0%";
}

/**
 * Formatea el tick del eje Y.
 * Igual que formatPct pero siempre muestra 1 decimal para alineado tabular.
 */
function formatTickPct(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return "0%";
}

// ─── Estructura de datos para el gráfico ─────────────────────────────────────

interface ChartPoint {
  month: string;         // "Ene", "Feb", ...
  monthFull: string;     // "Enero", ...
  monthIndex: number;    // 0–11
  inflation: number | null;
  income: number | null;
  incomeAdj: number | null;
  trendIncome: number | null;
  trendIncomeAdj: number | null;
}

/**
 * Convierte la respuesta del backend en los puntos del gráfico.
 */
function buildChartData(data: AnnualInflationIncomeResponse): ChartPoint[] {
  return data.months.map((m, i) => ({
    month: MONTH_LABELS_SHORT[i] ?? "",
    monthFull: MONTH_LABELS_FULL[i] ?? "",
    monthIndex: i,
    inflation: m.inflationPct,
    income: m.incomePct,
    incomeAdj: m.incomePctAdj,
    trendIncome: data.incomeTrend.points?.[i] ?? null,
    trendIncomeAdj: data.incomeAdjTrend.points?.[i] ?? null,
  }));
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InflationIncomeSkeleton() {
  return (
    <div role="status" aria-label="Cargando reporte">
      {/* Canvas skeleton */}
      <SkeletonBlock height={300} radius="ctl" />
      {/* 3 chips fantasma de leyenda */}
      <div className="mt-[14px] flex gap-[10px]">
        {[72, 110, 120].map((w, i) => (
          <SkeletonLine key={i} height={26} width={w} />
        ))}
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

function InflationIncomeError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="alert">
      <AlertTriangle size={20} aria-hidden="true" className="text-warning-ink" />
      <p className="text-[14px] text-ink-2">No se pudo cargar el reporte.</p>
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

// ─── YearStepper ─────────────────────────────────────────────────────────────

interface YearStepperProps {
  year: number;
  currentYear: number;
  earliestYear: number | null;
  onPrev: () => void;
  onNext: () => void;
}

function YearStepper({ year, currentYear, earliestYear, onPrev, onNext }: YearStepperProps) {
  const canGoNext = year < currentYear;
  const canGoPrev = earliestYear === null || year > earliestYear;

  return (
    <div
      className="flex items-center rounded-pill border border-line bg-panel shadow-[var(--shadow-sm)] p-1"
      role="group"
      aria-label="Navegación de año"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Año anterior"
        aria-disabled={!canGoPrev}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
          canGoPrev
            ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            : "text-faint opacity-45 cursor-default",
        )}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <span
        className="mono text-[14.5px] font-semibold text-ink min-w-[52px] text-center select-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {year}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Año siguiente"
        aria-disabled={!canGoNext}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
          canGoNext
            ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            : "text-faint opacity-45 cursor-default",
        )}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
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

// ─── Tooltip custom ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null }>;
  label?: string | number;
  hiddenSeries: string[];
  year: number;
  /** Marcas de límite por mes (P2 — Tramo 2): reporte.infl.*. */
  inflationMarks?: (EvaluatedLimitMark | null)[];
  incomeVarMarks?: (EvaluatedLimitMark | null)[];
  incomeVarAdjMarks?: (EvaluatedLimitMark | null)[];
}

export function CustomTooltip({
  active,
  payload,
  label,
  hiddenSeries,
  year,
  inflationMarks,
  incomeVarMarks,
  incomeVarAdjMarks,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Resolver el monthIndex desde el label (short month name)
  const monthIndex = MONTH_LABELS_SHORT.indexOf(label as string);
  const monthFull = monthIndex >= 0 ? (MONTH_LABELS_FULL[monthIndex] ?? label) : label;

  // Las tendencias (trendIncome, trendIncomeAdj) NO se muestran en el tooltip.
  // Solo las 3 series de dato visibles.
  const seriesMap: Array<{ key: string; id: string; label: string }> = [
    { key: "inflation", id: SERIES_IDS.inflation, label: "Inflación" },
    { key: "income", id: SERIES_IDS.income, label: "Ingresos (nominal)" },
    { key: "incomeAdj", id: SERIES_IDS.incomeAdj, label: "Ingresos (ajustado)" },
  ];

  const rows: Array<{ id: string; label: string; value: number | null; color: string; dashed: boolean }> = [];

  for (const s of seriesMap) {
    if (hiddenSeries.includes(s.id)) continue;
    const entry = payload.find((p) => p.name === s.key);
    if (!entry || entry.value === null || entry.value === undefined) continue;
    rows.push({
      id: s.id,
      label: s.label,
      value: entry.value,
      color: s.id === SERIES_IDS.inflation ? "var(--rate)" : "var(--income)",
      dashed: s.id === SERIES_IDS.incomeAdj,
    });
  }

  if (rows.length === 0) return null;

  // P2 — Tramo 2: combina las 3 marcas de este mes (la más fuerte gana) — portador de a11y.
  let mergedMark: EvaluatedLimitMark | null = null;
  if (monthIndex >= 0) {
    mergedMark = mergeLimitMarks(mergedMark, inflationMarks?.[monthIndex] ?? null);
    mergedMark = mergeLimitMarks(mergedMark, incomeVarMarks?.[monthIndex] ?? null);
    mergedMark = mergeLimitMarks(mergedMark, incomeVarAdjMarks?.[monthIndex] ?? null);
  }

  return (
    <div
      className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
      style={{ boxShadow: "var(--shadow-lg)", minWidth: "200px" }}
    >
      {/* Encabezado: mes + año */}
      <p className="mb-[8px] font-semibold text-ink">{monthFull} {year}</p>

      {/* Filas de series */}
      <div className="flex flex-col gap-[5px]">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-[7px]">
            {/* Swatch: cuadrado pleno o mini-línea dasheada para ajustada */}
            {row.dashed ? (
              // Mini-línea dasheada 14px para la serie ajustada
              <span
                aria-hidden="true"
                className="shrink-0 flex items-center"
                style={{ width: 14, height: 8 }}
              >
                <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
                  <line
                    x1="0" y1="1" x2="14" y2="1"
                    stroke={row.color}
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                </svg>
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="shrink-0 rounded-[3px]"
                style={{ width: 8, height: 8, background: row.color }}
              />
            )}
            {/* Nombre */}
            <span className="flex-1 text-ink-2 truncate">{row.label}</span>
            {/* Valor en mono tabular — neutro --ink (no semántico) */}
            <span className="mono shrink-0 text-ink tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              {row.value !== null ? formatPct(row.value) : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Nota de límite cruzado (P2 — Tramo 2): portador de a11y del punto. */}
      {mergedMark && (
        <>
          <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />
          <div className="flex items-center gap-[6px]">
            <AlertTriangle size={12} aria-hidden="true" className="shrink-0 text-warning-ink" />
            <span className="text-[11.5px] font-medium text-warning-ink">{describeLimitMark(mergedMark)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tick custom del eje Y ────────────────────────────────────────────────────

interface CustomYTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
}

function CustomYTick({ x = 0, y = 0, payload }: CustomYTickProps) {
  if (payload === undefined) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="middle"
      style={{
        fontFamily: "var(--mono)",
        fontSize: "11.5px",
        fill: "var(--muted)",
      }}
    >
      {formatTickPct(payload.value)}
    </text>
  );
}

// ─── Canvas del gráfico ───────────────────────────────────────────────────────

interface InflationIncomeCanvasProps {
  data: ChartPoint[];
  hiddenSeries: string[];
  showTrendIncome: boolean;
  showTrendIncomeAdj: boolean;
  hasTrendIncome: boolean;
  hasTrendIncomeAdj: boolean;
  isEmpty: boolean;
  year: number;
  reducedMotion: boolean;
  chartHeight: number;
  /** Marcas de límite por mes (P2 — Tramo 2): reporte.infl.*. [] con limits vacío. */
  inflationMarks?: (EvaluatedLimitMark | null)[];
  incomeVarMarks?: (EvaluatedLimitMark | null)[];
  incomeVarAdjMarks?: (EvaluatedLimitMark | null)[];
}

function InflationIncomeCanvas({
  data,
  hiddenSeries,
  showTrendIncome,
  showTrendIncomeAdj,
  hasTrendIncome,
  hasTrendIncomeAdj,
  isEmpty,
  year,
  reducedMotion,
  chartHeight,
  inflationMarks,
  incomeVarMarks,
  incomeVarAdjMarks,
}: InflationIncomeCanvasProps) {
  // Calcular dominio del eje Y con padding
  const allValues: number[] = [];
  for (const pt of data) {
    if (pt.inflation !== null) allValues.push(pt.inflation);
    if (pt.income !== null) allValues.push(pt.income);
    if (pt.incomeAdj !== null) allValues.push(pt.incomeAdj);
  }
  allValues.push(0); // siempre incluir el cero (baseline visible)

  const pad = 2; // padding mínimo en puntos porcentuales
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const domainMin = Math.floor(minVal - pad);
  const domainMax = Math.ceil(maxVal + pad);

  // El eje Y va de domainMin a domainMax, siempre incluyendo el 0
  const yMin = Math.min(domainMin, -pad);
  const yMax = Math.max(domainMax, pad);

  const isInflationVisible = !hiddenSeries.includes(SERIES_IDS.inflation);
  const isIncomeVisible = !hiddenSeries.includes(SERIES_IDS.income);
  const isIncomeAdjVisible = !hiddenSeries.includes(SERIES_IDS.incomeAdj);

  return (
    <div className="relative">
      {/* Overlay vacío — "Sin datos en {año}." */}
      {isEmpty && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          aria-live="polite"
        >
          <p className="text-[14px] text-muted">Sin datos en {year}.</p>
        </div>
      )}

      <ChartContainer height={chartHeight}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="0"
            horizontal={true}
            vertical={false}
            stroke="var(--hair)"
            strokeWidth={1}
          />

          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, fill: "var(--muted)" }}
            dy={4}
          />

          <YAxis
            domain={[yMin, yMax]}
            axisLine={false}
            tickLine={false}
            tick={<CustomYTick />}
            width={44}
          />

          {/* Baseline en cero — más marcada que los gridlines */}
          <ReferenceLine
            y={0}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray="0"
          />

          <Tooltip
            cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
            content={
              <CustomTooltip
                hiddenSeries={hiddenSeries}
                year={year}
                inflationMarks={inflationMarks}
                incomeVarMarks={incomeVarMarks}
                incomeVarAdjMarks={incomeVarAdjMarks}
              />
            }
          />

          {/*
            Orden de pintado (z): tendencias al fondo → inflación → ajustada → nominal arriba.
            En Recharts las líneas se pintan en orden de declaración: primero = fondo.
          */}

          {/* Tendencia ingresos ajustada — fondo absoluto */}
          {hasTrendIncomeAdj && showTrendIncomeAdj && (
            <Line
              type="linear"
              dataKey="trendIncomeAdj"
              name="trendIncomeAdj"
              stroke="var(--income)"
              strokeWidth={1.25}
              strokeOpacity={0.45}
              strokeDasharray="2 3"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
            />
          )}

          {/* Tendencia ingresos nominal */}
          {hasTrendIncome && showTrendIncome && (
            <Line
              type="linear"
              dataKey="trendIncome"
              name="trendIncome"
              stroke="var(--income)"
              strokeWidth={1.25}
              strokeOpacity={0.45}
              strokeDasharray="2 3"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
            />
          )}

          {/* Serie 1: Inflación (#1) — graphite --rate */}
          {isInflationVisible && (
            <Line
              type="monotone"
              dataKey="inflation"
              name="inflation"
              stroke="var(--rate)"
              strokeWidth={2}
              dot={((props: { cx?: number; cy?: number; index?: number }) =>
                renderSeriesPointMark(props, inflationMarks)) as unknown as boolean}
              activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2, fill: "var(--rate)" }}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
            />
          )}

          {/* Serie 3: Ingresos ajustados (#3) — income dasheada `6 4` */}
          {isIncomeAdjVisible && (
            <Line
              type="monotone"
              dataKey="incomeAdj"
              name="incomeAdj"
              stroke="var(--income)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={((props: { cx?: number; cy?: number; index?: number }) =>
                renderSeriesPointMark(props, incomeVarAdjMarks)) as unknown as boolean}
              activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2, fill: "var(--income)" }}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
            />
          )}

          {/* Serie 2: Ingresos nominal (#2) — income sólida, encima de todas */}
          {isIncomeVisible && (
            <Line
              type="monotone"
              dataKey="income"
              name="income"
              stroke="var(--income)"
              strokeWidth={2}
              dot={((props: { cx?: number; cy?: number; index?: number }) =>
                renderSeriesPointMark(props, incomeVarMarks)) as unknown as boolean}
              activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2, fill: "var(--income)" }}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
            />
          )}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

// ─── Leyenda con swatch dasheado ──────────────────────────────────────────────

/**
 * Ítems de leyenda para las 3 series.
 * La serie ajustada necesita un swatch custom (mini-línea dasheada).
 * Usamos ChartLegend con sus ítems normales pero para la ajustada
 * el "color" es especial — manejado con un renderizado custom del swatch.
 */
interface SeriesLegendProps {
  hiddenSeries: string[];
  onToggle: (id: string) => void;
}

function SeriesLegend({ hiddenSeries, onToggle }: SeriesLegendProps) {
  const items = [
    { id: SERIES_IDS.inflation, label: "Inflación", dashed: false, color: "var(--rate)" },
    { id: SERIES_IDS.income, label: "Ingresos (nominal)", dashed: false, color: "var(--income)" },
    { id: SERIES_IDS.incomeAdj, label: "Ingresos (ajustado)", dashed: true, color: "var(--income)" },
  ];

  return (
    <div
      role="group"
      aria-label="Filtrar series"
      className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] -mx-[6px] mt-[14px]"
    >
      {items.map((item) => {
        const isOff = hiddenSeries.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={!isOff}
            onClick={() => onToggle(item.id)}
            className={cn(
              "group inline-flex items-center gap-[6px] px-[6px] py-[4px] rounded-[7px]",
              "cursor-pointer transition-[background-color,opacity] duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "hover:bg-panel-2 active:bg-panel-3",
              isOff ? "opacity-70 hover:opacity-85" : "opacity-100",
            )}
          >
            {/* Swatch: mini-línea dasheada para ajustada, cuadrado pleno/outline para las otras */}
            {item.dashed ? (
              <span
                aria-hidden="true"
                className="shrink-0 flex items-center"
                style={{ width: 14, height: 10 }}
              >
                <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
                  <line
                    x1="0" y1="1" x2="14" y2="1"
                    stroke={item.color}
                    strokeWidth="2"
                    strokeDasharray={isOff ? "0" : "6 4"}
                    opacity={isOff ? 0.5 : 1}
                  />
                </svg>
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="shrink-0 rounded-[3px]"
                style={{
                  width: 10,
                  height: 10,
                  ...(isOff
                    ? {
                        background: "var(--panel)",
                        border: `1.5px solid ${item.color}`,
                      }
                    : {
                        background: item.color,
                      }),
                }}
              />
            )}
            {/* Etiqueta */}
            <span
              className={cn(
                "text-[12.5px] font-medium select-none transition-colors duration-[140ms]",
                isOff
                  ? "text-muted line-through group-hover:text-ink-2"
                  : "text-ink-2 group-hover:text-ink",
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── InflationIncomeCard — Props ──────────────────────────────────────────────

export interface InflationIncomeCardProps {
  year: number;
  categoryIds?: string[] | null;
  currency?: CurrencyCode;
  title?: string;
  titlePlaceholder?: string;
  removable?: boolean;
  chartHeight?: number;
  onYearChange?: (year: number) => void;
  onCategoryIdsChange?: (ids: string[] | null) => void;
  onCurrencyChange?: (c: CurrencyCode) => void;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
}

// ─── InflationIncomeCard ──────────────────────────────────────────────────────

/**
 * Card de reporte "Inflación vs Ingresos" (Ola 4, P5).
 *
 * Encapsula:
 * - Cabecera: título editable + YearStepper + CardCurrencySelect + X
 * - Canvas: LineChart de Recharts con 3 series + 2 tendencias
 * - Leyenda interactiva de 3 series (toggle)
 * - Filtro de categorías (ChartLegend scrollable) debajo
 */
export function InflationIncomeCard({
  year,
  categoryIds = null,
  currency,
  title: titleProp,
  titlePlaceholder = "Reporte",
  removable = false,
  chartHeight = 300,
  onYearChange,
  onCategoryIdsChange,
  onCurrencyChange,
  onRemove,
  onTitleChange,
}: InflationIncomeCardProps) {
  const { defaultCurrency } = useSettings();
  const effectiveCurrency = currency ?? defaultCurrency;
  const reducedMotion = useReducedMotion();
  // P2 — Fase 1 (Tramo 2): límites del usuario (marca visual pasiva). [] = cero impacto (D9).
  const { limits } = useLimits();

  // Fecha local para el parámetro ?today= (igual que annual-unicos)
  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const { data, isLoading, isError, isFetching, refetch } = useInflationIncome(year, categoryIds, currency, today);

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Estado de series ocultas en la leyenda ─────────────────────────────────
  // Las 3 series tienen su propio toggle; las tendencias siguen a su serie madre.
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  function handleLegendToggle(id: string) {
    setHiddenSeries((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  // ── Estado de edición del título ───────────────────────────────────────────
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

  // ── Año actual ─────────────────────────────────────────────────────────────
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  useEffect(() => { setCurrentYear(new Date().getFullYear()); }, []);

  function handlePrev() { onYearChange?.(year - 1); }
  function handleNext() { if (year < currentYear) onYearChange?.(year + 1); }

  // ── Lógica de categorías ───────────────────────────────────────────────────
  const availableCategories = useMemo(
    () => data?.availableCategories ?? [],
    [data?.availableCategories],
  );

  const handleCategoryLegendToggle = useCallback(
    (categoryId: string) => {
      if (availableCategories.length === 0) return;
      const allIds = availableCategories.map((c) => c.categoryId);
      const currentActive: string[] = categoryIds === null ? allIds : categoryIds;
      const isCurrentlyActive = currentActive.includes(categoryId);
      let newIds: string[] | null;
      if (isCurrentlyActive) {
        const remaining = currentActive.filter((id) => id !== categoryId);
        newIds = remaining.length === allIds.length ? null : remaining;
      } else {
        const added = [...currentActive, categoryId];
        newIds = added.length === allIds.length ? null : added;
      }
      onCategoryIdsChange?.(newIds);
    },
    [availableCategories, categoryIds, onCategoryIdsChange],
  );

  const hiddenCategoryIds: string[] = (() => {
    if (categoryIds === null) return [];
    const activeSet = new Set(categoryIds);
    return availableCategories.filter((c) => !activeSet.has(c.categoryId)).map((c) => c.categoryId);
  })();

  const categoryLegendItems = availableCategories.map((cat) => ({
    id: cat.categoryId,
    color: cat.color,
    label: cat.name,
  }));

  // ── Datos del gráfico ──────────────────────────────────────────────────────
  const chartData = useMemo(() => (data ? buildChartData(data) : []), [data]);

  // P2 — Fase 1 (Tramo 2): marca visual pasiva de límites — reporte.infl.*.
  // Con `limits` vacío, evaluateLimits siempre null → cero impacto (D9).
  const { inflation: inflationMarks, incomeVar: incomeVarMarks, incomeVarAdj: incomeVarAdjMarks } = useMemo(
    () => (data ? computeInflationIncomeMarks(limits, year, data.months) : { inflation: [], incomeVar: [], incomeVarAdj: [] }),
    [limits, year, data],
  );

  // ¿Está "vacío"? → todas las series de dato tienen null en todos los meses
  // O todas las 3 series están ocultas.
  const allSeriesHidden = hiddenSeries.length >= 3;
  const hasAnyData = data
    ? data.months.some(
        (m) => m.inflationPct !== null || m.incomePct !== null || m.incomePctAdj !== null,
      )
    : false;
  const isEmpty = !hasAnyData || allSeriesHidden;

  // Tendencias: solo se dibujan si tienen points y la serie madre está visible
  const hasTrendIncome = Boolean(data?.incomeTrend.points);
  const hasTrendIncomeAdj = Boolean(data?.incomeAdjTrend.points);
  const showTrendIncome = hasTrendIncome && !hiddenSeries.includes(SERIES_IDS.income);
  const showTrendIncomeAdj = hasTrendIncomeAdj && !hiddenSeries.includes(SERIES_IDS.incomeAdj);

  const earliestYear = data?.earliestYear ?? null;
  const displayTitle = titleProp ?? titlePlaceholder;

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade"
      aria-label={`${displayTitle} ${year}`}
    >
      {/* ── Cabecera ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
        <div className="min-w-0 flex-1">
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

        {/* Controles derecha: stepper + moneda + X */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <YearStepper
            year={year}
            currentYear={currentYear}
            earliestYear={earliestYear}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          {onCurrencyChange && (
            <>
              <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
              <CardCurrencySelect value={effectiveCurrency} onChange={onCurrencyChange} />
            </>
          )}

          <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Actualizar reporte"
            aria-busy={isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-muted"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={cn(isFetching && "animate-spin motion-reduce:animate-none")}
            />
          </button>
          {removable && (
            <button
              ref={removeButtonRef}
              type="button"
              onClick={() => setRemoveOpen((o) => !o)}
              aria-label="Quitar reporte"
              className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Área de contenido ── */}
      {isError ? (
        <InflationIncomeError onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <InflationIncomeSkeleton />
      ) : (
        <>
          {/* Canvas del gráfico */}
          <InflationIncomeCanvas
            data={chartData}
            hiddenSeries={hiddenSeries}
            showTrendIncome={showTrendIncome}
            showTrendIncomeAdj={showTrendIncomeAdj}
            hasTrendIncome={hasTrendIncome}
            hasTrendIncomeAdj={hasTrendIncomeAdj}
            isEmpty={isEmpty}
            year={year}
            reducedMotion={reducedMotion}
            chartHeight={chartHeight}
            inflationMarks={inflationMarks}
            incomeVarMarks={incomeVarMarks}
            incomeVarAdjMarks={incomeVarAdjMarks}
          />

          {/* Leyenda de series (toggle de 3 ítems) */}
          <SeriesLegend
            hiddenSeries={hiddenSeries}
            onToggle={handleLegendToggle}
          />

          {/* Filtro de categorías — chips-toggle scrollable debajo */}
          {availableCategories.length > 0 && (
            <div className="mt-[10px]">
              <ChartLegend
                items={categoryLegendItems}
                hiddenIds={hiddenCategoryIds}
                onToggle={handleCategoryLegendToggle}
                groupLabel="Filtrar categorías de ingreso"
                scrollable
              />
            </div>
          )}
        </>
      )}

      {/* Popover de confirmación quitar */}
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
