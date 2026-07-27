"use client";

/**
 * Widget de reporte autónomo — Pantalla 8 (RF-REP-001/002, Fase 1.1.5).
 *
 * Export principal:
 *   - ReportCard: widget autónomo que engloba controles + gráfico.
 *     Acepta tipo (income-expense / by-category), año, categoryIds, callbacks.
 *
 * Spec visual: docs/design.md, sección "Reportes configurables — spec visual (Fase 1.1.5)"
 *   y "Leyenda interactiva (la leyenda es el filtro)" (Ola 2, P1).
 *
 * Ola 2 — Sub-fase A:
 *   - La leyenda es el filtro (P1): ChartLegend interactivo con toggle buttons (aria-pressed).
 *   - Elimina FilterButton + CategoryFilterPopover de la card (el popover sigue en /mes).
 *   - Categorías relevantes (P2_b): universo de leyenda sale de availableCategories, no de useCategories.
 *
 * RF-REP-014 (rework leyenda income-expense):
 *   - Elimina leyenda de series (hiddenSeries / toggle Ingresos/Gastos).
 *   - Footer de income-expense en /reportes = leyenda-filtro de categorías tildables
 *     (mismo ChartLegend interactivo que by-category; escribe en categoryIds).
 *   - Elimina FilterButton + CategoryFilterPopover de la cabecera de income-expense (ahora en footer).
 *   - Dashboard conserva leyenda decorativa de 2 series (Ingresos/Gastos) no interactiva.
 *   - Dirección es el ÚNICO control de cuántas líneas muestra el canvas (no la leyenda).
 *
 * prefers-reduced-motion: isAnimationActive={false} cuando está activo.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useReports } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
import { useLimits } from "@/hooks/use-limits";
import {
  computeIncomeExpenseMarks,
  computeByCategoryMarks,
  type ByCategoryMarks,
} from "@/lib/limits/apply-reports";
import { describeLimitMark, mergeLimitMarks, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { renderSeriesPointMark } from "@/components/limits/limit-mark";
import { LimitsInfoPopover } from "@/components/limits/limits-info-popover";
import { formatCurrency, CURRENCY_SYMBOLS } from "@/lib/format";
import { ChartTooltipContent } from "@/components/ui/chart";
import { ChartLegend } from "@/components/ui/chart";
import { CardCurrencySelect } from "@/components/ui/card-currency-select";
import type { ReportsMovementsResponse, ReportCardType } from "@/types/reports";
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

// ─── Helpers de formato del eje Y ─────────────────────────────────────────────

/**
 * Crea un formateador de ticks del eje Y con el símbolo de la moneda indicada.
 * Se llama una vez por render (en el nivel del chart) y devuelve el formatter.
 * Así tickFormatter recibe el símbolo correcto sin perder la firma `(number) => string`.
 */
function makeYAxisTickFormatter(currency: string): (valueCents: number) => string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  return function formatYAxisTick(valueCents: number): string {
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

// ─── Tipos de datos del chart ──────────────────────────────────────────────────

interface ChartDataPoint {
  monthIndex: number;
  shortLabel: string;
  fullLabel: string;
  incomeCents: number;
  expenseCents: number;
  [key: string]: number | string | undefined;
}

function buildChartData(data: ReportsMovementsResponse): ChartDataPoint[] {
  return data.months.map((m, i) => {
    const point: ChartDataPoint = {
      monthIndex: i,
      shortLabel: MONTH_LABELS_SHORT[i] ?? String(i + 1),
      fullLabel: MONTH_LABELS_FULL[i] ?? String(i + 1),
      incomeCents: m.incomeCents,
      expenseCents: m.expenseCents,
    };
    // Gastos por categoría (Forma 2 + Vista B)
    data.categories.forEach((cat) => {
      point[cat.categoryId] = cat.monthlyExpenseCents[i] ?? 0;
    });
    return point;
  });
}

// ─── Tooltip — Forma 1 ────────────────────────────────────────────────────────

interface Form1TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string | number;
  year: number;
  currency: string;
  /** Dirección de cómputo — determina qué series aparecen en el tooltip. */
  direction?: "expense" | "income" | "both";
  /** Marcas de límite por mes (P2 — Tramo 2): reporte.ie.gastoMes / .ingresoMes. */
  expenseMarks?: (EvaluatedLimitMark | null)[];
  incomeMarks?: (EvaluatedLimitMark | null)[];
}

export function Form1Tooltip({
  active,
  payload,
  label,
  year,
  currency,
  direction,
  expenseMarks,
  incomeMarks,
}: Form1TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const labelStr = String(label ?? "");
  const monthIndex = MONTH_LABELS_SHORT.indexOf(labelStr);
  if (monthIndex === -1) return null;

  const fullLabel = `${MONTH_LABELS_FULL[monthIndex] ?? label} ${year}`;

  function getSeriesValue(series: "income" | "expense"): number {
    const key = series === "income" ? "incomeCents" : "expenseCents";
    return payload!.find((p) => p.dataKey === key)?.value ?? 0;
  }

  const showIncome = direction !== "expense";
  const showExpense = direction !== "income";

  const rows = [
    ...(showIncome
      ? [{
          color: "var(--income)",
          label: "Ingresos",
          formattedValue: formatCurrency(getSeriesValue("income"), currency),
          valueColor: "var(--income-ink)",
        }]
      : []),
    ...(showExpense
      ? [{
          color: "var(--expense)",
          label: "Gastos",
          formattedValue: formatCurrency(getSeriesValue("expense"), currency),
          valueColor: "var(--expense-ink)",
        }]
      : []),
  ];
  if (rows.length === 0) return null;

  // P2 — Tramo 2: la marca de este mes (gasto y/o ingreso) es el portador de a11y del punto.
  const mergedMark = mergeLimitMarks(
    showExpense ? expenseMarks?.[monthIndex] ?? null : null,
    showIncome ? incomeMarks?.[monthIndex] ?? null : null,
  );
  const warningNote = mergedMark ? describeLimitMark(mergedMark) : undefined;

  return <ChartTooltipContent monthLabel={fullLabel} rows={rows} warningNote={warningNote} />;
}

// ─── Tooltip — Forma 2 ────────────────────────────────────────────────────────

interface Form2TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string | number;
  data: ReportsMovementsResponse;
  year: number;
  currency: string;
  /** Marcas de límite (P2 — Tramo 2): reporte.cat.gastoMesCategoria / .gastoMesTotal. */
  categoryMarks?: ByCategoryMarks;
}

export function Form2Tooltip({ active, payload, label, data, year, currency, categoryMarks }: Form2TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const labelStr = String(label ?? "");
  const monthIndex = MONTH_LABELS_SHORT.indexOf(labelStr);
  if (monthIndex === -1) return null;
  const fullLabel = `${MONTH_LABELS_FULL[monthIndex] ?? label} ${year}`;
  const catRows = data.categories
    .filter((cat) => (cat.monthlyExpenseCents[monthIndex] ?? 0) > 0)
    .map((cat) => ({
      color: cat.color,
      label: cat.name,
      formattedValue: formatCurrency(cat.monthlyExpenseCents[monthIndex] ?? 0, currency),
      valueColor: "var(--ink)",
    }));
  const totalCents = data.months[monthIndex]?.expenseCents ?? 0;
  const totalRow = { color: "var(--expense)", label: "Total gastos", formattedValue: formatCurrency(totalCents, currency), valueColor: "var(--expense-ink)" };

  // P2 — Tramo 2: combina las marcas de todas las categorías + el total de ESTE mes
  // en una sola (la más fuerte gana) — portador de a11y del mes hovereado.
  let mergedMark: EvaluatedLimitMark | null = categoryMarks?.total[monthIndex] ?? null;
  if (categoryMarks) {
    for (const marks of categoryMarks.perCategory.values()) {
      mergedMark = mergeLimitMarks(mergedMark, marks[monthIndex] ?? null);
    }
  }
  const warningNote = mergedMark ? describeLimitMark(mergedMark) : undefined;

  return <ChartTooltipContent monthLabel={fullLabel} rows={catRows} totalRow={totalRow} warningNote={warningNote} />;
}

// ─── Toggle de vista — tabs underline neutras ────────────────────────────────

/**
 * Tabs underline neutras genéricas. Usadas por:
 *   - by-category: toggle Barra/Línea (categoryChartMode).
 * Eliminadas de income-expense (queda Total-only).
 *
 * Props:
 *   tabs: array de { label, id, val: T }
 *   value: valor activo
 *   onChange: callback con el nuevo valor
 *   panelId: aria-controls del tabpanel del canvas
 *   ariaLabel: aria-label del role="tablist"
 */
interface ViewTabsProps<T extends string | boolean> {
  tabs: ReadonlyArray<{ label: string; id: string; val: T }>;
  value: T;
  onChange: (v: T) => void;
  panelId: string;
  ariaLabel: string;
}

function ViewTabs<T extends string | boolean>({ tabs, value, onChange, panelId, ariaLabel }: ViewTabsProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const reducedMotionTabs = useReducedMotion();

  const selectedIndex = tabs.findIndex((t) => t.val === value);

  useEffect(() => {
    const btn = tabRefs.current[selectedIndex];
    if (!btn) return;
    setUnderline({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = tabs[(idx + 1) % tabs.length];
      if (next) onChange(next.val);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      if (prev) onChange(prev.val);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="relative flex items-end gap-[18px] pb-[2px]"
    >
      {/* Underline deslizante — posicionado con left/width medidos del tab activo */}
      {underline && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 h-[2px] bg-ink",
            reducedMotionTabs
              ? ""
              : "transition-[left,width] duration-[180ms] ease-out",
          )}
          style={{ left: underline.left, width: underline.width }}
        />
      )}
      {tabs.map((tab, i) => {
        const isSelected = tab.val === value;
        return (
          <button
            key={tab.id}
            id={tab.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={panelId}
            onClick={() => onChange(tab.val)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              "relative py-[6px] text-[13px] font-semibold leading-none",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "transition-colors duration-[140ms]",
              isSelected
                ? "text-ink"
                : "text-muted hover:text-ink-2 hover:shadow-[inset_0_-2px_0_var(--line-strong)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Tabs para by-category (Barra / Línea)
const BY_CATEGORY_TABS = [
  { label: "Barra", val: "bar" as const, id: "tab-barra" },
  { label: "Línea", val: "line" as const, id: "tab-linea" },
] as const;

// ─── DirectionSegmented — control de dirección (Gastos/Ingresos/Ambos) ────────

/**
 * Segmented control de 3 opciones para elegir la dirección de cómputo de la
 * card income-expense (RF-REP-014).
 *
 * Reusa el mismo patrón visual del triple switch de tipo (SectionFilterPopover),
 * adaptado a las etiquetas "Gastos / Ingresos / Ambos" y sus colores semánticos.
 *
 * Spec: docs/design.md §"Filtros de tipo, dirección y categoría en income-expense" →
 *       §2 "Dirección — segmented neutro de 3".
 */

interface DirectionSegmentedProps {
  value: "expense" | "income" | "both";
  onChange: (v: "expense" | "income" | "both") => void;
}

const DIRECTION_SEGMENTS: Array<{
  value: "expense" | "income" | "both";
  label: string;
  activeColor: string;
}> = [
  { value: "expense", label: "Gastos", activeColor: "var(--expense-ink)" },
  { value: "income", label: "Ingresos", activeColor: "var(--income-ink)" },
  { value: "both", label: "Ambos", activeColor: "var(--accent-ink)" },
];

function DirectionSegmented({ value, onChange }: DirectionSegmentedProps) {
  const selectedIndex = DIRECTION_SEGMENTS.findIndex((s) => s.value === value);
  const reducedMotion = useReducedMotion();

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = DIRECTION_SEGMENTS[(idx + 1) % DIRECTION_SEGMENTS.length];
      if (next) onChange(next.value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = DIRECTION_SEGMENTS[(idx - 1 + DIRECTION_SEGMENTS.length) % DIRECTION_SEGMENTS.length];
      if (prev) onChange(prev.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Dirección"
      className="relative inline-flex items-center rounded-pill p-[2px]"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      {/* Thumb deslizante (el "panelito blanco elevado" del segmento seleccionado) */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[2px] bottom-[2px] rounded-pill bg-panel shadow-[var(--shadow-sm)]",
          reducedMotion ? "" : "transition-[left,width] duration-[140ms] ease-out",
        )}
        style={{
          left: `calc(${(selectedIndex / 3) * 100}% + 2px)`,
          width: `calc(${100 / 3}% - 4px)`,
        }}
      />
      {DIRECTION_SEGMENTS.map((seg, i) => {
        const isSelected = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(seg.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              "relative z-10 flex-1 px-[10px] py-[5px] text-[12.5px] font-semibold rounded-pill",
              "select-none transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
            )}
            style={{ color: isSelected ? seg.activeColor : "var(--muted)" }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── MovementTypeChips — filtro de tipo multi-selección (Fijos/Cuotas/Únicos) ──

/**
 * Tres chip-toggle para filtrar por tipo de movimiento en la card income-expense (RF-REP-014).
 *
 * Multi-selección (aria-pressed). Default: los tres incluidos.
 * El estado "los tres apagados" se permite; el canvas queda vacío → empty estándar.
 *
 * Spec: docs/design.md §"Filtros de tipo, dirección y categoría en income-expense" →
 *       §3 "Tipo de movimiento — 3 chips-toggle neutros".
 */

interface MovementTypeChipsProps {
  value: Array<"fijo" | "cuota" | "unico">;
  onChange: (types: Array<"fijo" | "cuota" | "unico">) => void;
}

const MOVEMENT_TYPE_CHIPS: Array<{ value: "fijo" | "cuota" | "unico"; label: string }> = [
  { value: "fijo", label: "Fijos" },
  { value: "cuota", label: "Cuotas" },
  { value: "unico", label: "Únicos" },
];

function MovementTypeChips({ value, onChange }: MovementTypeChipsProps) {
  function toggle(type: "fijo" | "cuota" | "unico") {
    const isOn = value.includes(type);
    if (isOn) {
      onChange(value.filter((t) => t !== type));
    } else {
      onChange([...value, type]);
    }
  }

  return (
    <div role="group" aria-label="Tipo de movimiento" className="flex items-center gap-[6px]">
      {MOVEMENT_TYPE_CHIPS.map((chip) => {
        const isOn = value.includes(chip.value);
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={isOn}
            onClick={() => toggle(chip.value)}
            className={cn(
              "inline-flex items-center px-[10px] py-[5px] rounded-[7px]",
              "text-[12.5px] font-semibold select-none",
              "transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              isOn
                // Seleccionado/incluido: panel elevado — "pieza activa"
                ? "bg-panel border border-line-strong shadow-[var(--shadow-sm)] text-ink"
                // No seleccionado/excluido: plano — "hundido/inactivo"
                : "bg-panel-2 border border-line text-muted hover:text-ink-2 hover:border-line-strong active:bg-panel-3",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

// ID del panel de gráfico (para aria-controls de tabs)
const CHART_PANEL_ID = "report-chart-panel";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div role="status" aria-label="Cargando gráfico">
      <SkeletonBlock height={height} radius="ctl" />
      <div className="mt-[14px] flex gap-4">
        {[70, 56, 80].map((w, i) => (
          <SkeletonLine key={i} height={14} width={w} />
        ))}
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

function ChartError({ height, onRetry }: { height: number; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height }} role="alert">
      <AlertTriangle size={20} aria-hidden="true" className="text-warning-ink" />
      <p className="text-[14px] text-ink-2">No se pudo cargar el gráfico.</p>
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

// ─── Área del gráfico con responsivo ──────────────────────────────────────────

interface ChartResponsiveAreaProps {
  desktopHeight: number;
  children: (height: number) => React.ReactNode;
}

function ChartResponsiveArea({ desktopHeight, children }: ChartResponsiveAreaProps) {
  // Container query sobre <main> (`@wide:`/`@max-wide:`), no media query de
  // viewport: la altura del gráfico depende del ancho REAL de contenido
  // disponible (que se estrecha con el sidebar abierto), no del viewport
  // crudo — docs/design.md §"Ancho de contenido de página".
  return (
    <>
      <div className="@max-wide:hidden" style={{ height: desktopHeight }}>
        {children(desktopHeight)}
      </div>
      <div className="@wide:hidden" style={{ height: 220 }}>
        {children(220)}
      </div>
    </>
  );
}

// ─── Forma 1 — AreaChart interno ─────────────────────────────────────────────────

interface Form1ChartInnerProps {
  chartData: ChartDataPoint[];
  year: number;
  height: number;
  reducedMotion: boolean;
  currency: string;
  /** Dirección de cómputo — determina qué series se renderizan en el chart. */
  direction?: "expense" | "income" | "both";
  /** Marcas de límite por mes (P2 — Tramo 2): reporte.ie.gastoMes / .ingresoMes. [] con limits vacío. */
  expenseMarks?: (EvaluatedLimitMark | null)[];
  incomeMarks?: (EvaluatedLimitMark | null)[];
}

function Form1ChartInner({
  chartData,
  year,
  height,
  reducedMotion,
  currency,
  direction,
  expenseMarks,
  incomeMarks,
}: Form1ChartInnerProps) {
  const formatYAxisTick = makeYAxisTickFormatter(currency);
  const showIncome = direction !== "expense";
  const showExpense = direction !== "income";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="areaIncomeRep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--income)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--income)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="areaExpenseRep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--expense)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal vertical={false} stroke="var(--hair)" strokeWidth={1} />
        <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: "var(--muted)", fontFamily: "var(--ui)" }} interval={0} />
        <YAxis axisLine={false} tickLine={false} tickCount={5} tickFormatter={formatYAxisTick} tick={{ fontSize: 11.5, fill: "var(--muted)", fontFamily: "var(--mono)" }} width={64} />
        <Tooltip
          cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
          content={({ active, payload, label }) => (
            <Form1Tooltip
              active={active}
              payload={payload as unknown as Array<{ dataKey: string; value: number }>}
              label={label}
              year={year}
              currency={currency}
              direction={direction}
              expenseMarks={expenseMarks}
              incomeMarks={incomeMarks}
            />
          )}
        />

        {/* Gastos primero (debajo), ingresos encima — spec design.md */}
        {showExpense && (
          <Area
            type="monotone"
            dataKey="expenseCents"
            stroke="var(--expense)"
            strokeWidth={2}
            fill="url(#areaExpenseRep)"
            dot={((props: { cx?: number; cy?: number; index?: number }) =>
              renderSeriesPointMark(props, expenseMarks)) as unknown as boolean}
            activeDot={{ r: 4, fill: "var(--expense)", stroke: "var(--panel)", strokeWidth: 2 }}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
            animationEasing="ease-out"
          />
        )}
        {showIncome && (
          <Area
            type="monotone"
            dataKey="incomeCents"
            stroke="var(--income)"
            strokeWidth={2}
            fill="url(#areaIncomeRep)"
            dot={((props: { cx?: number; cy?: number; index?: number }) =>
              renderSeriesPointMark(props, incomeMarks)) as unknown as boolean}
            activeDot={{ r: 4, fill: "var(--income)", stroke: "var(--panel)", strokeWidth: 2 }}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
            animationEasing="ease-out"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Forma 2 — BarChart interno ───────────────────────────────────────────────

interface Form2ChartInnerProps {
  chartData: ChartDataPoint[];
  data: ReportsMovementsResponse;
  year: number;
  height: number;
  reducedMotion: boolean;
  currency: string;
  /**
   * Marcas de límite (P2 — Tramo 2): reporte.cat.gastoMesCategoria (por banda) y
   * reporte.cat.gastoMesTotal (banda superior del stack). La barra ya está
   * teñida por color de categoría (identidad) — no se recolorea; el efecto se
   * expresa como contorno ámbar (mecanismo "ring") sobre la celda marcada,
   * cualquiera sea el `effect` elegido (docs/design.md: la banda apilada no
   * tiene etiqueta de monto propia donde anclar glyph/badge — ver nota en
   * apply-reports.ts / reporte al orquestador). El portador de a11y completo
   * es el tooltip (warningNote de Form2Tooltip).
   */
  categoryMarks?: ByCategoryMarks;
}

function Form2ChartInner({ chartData, data, year, height, reducedMotion, currency, categoryMarks }: Form2ChartInnerProps) {
  const categories = data.categories;
  const formatYAxisTick = makeYAxisTickFormatter(currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="27%">
        <CartesianGrid horizontal vertical={false} stroke="var(--hair)" strokeWidth={1} />
        <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: "var(--muted)", fontFamily: "var(--ui)" }} interval={0} />
        <YAxis axisLine={false} tickLine={false} tickCount={5} tickFormatter={formatYAxisTick} tick={{ fontSize: 11.5, fill: "var(--muted)", fontFamily: "var(--mono)" }} width={64} />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)", fillOpacity: 0.5 }}
          content={({ active, payload, label }) => (
            <Form2Tooltip
              active={active}
              payload={payload as unknown as Array<{ dataKey: string; value: number }>}
              label={label}
              data={data}
              year={year}
              currency={currency}
              categoryMarks={categoryMarks}
            />
          )}
        />
        {categories.map((cat, idx) => {
          const isTop = idx === categories.length - 1;
          const catMonthMarks = categoryMarks?.perCategory.get(cat.categoryId);
          return (
            <Bar key={cat.categoryId} dataKey={cat.categoryId} stackId="categories" fill={cat.color} stroke="var(--panel)" strokeWidth={1} radius={isTop ? [7, 7, 0, 0] : [0, 0, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={400} animationEasing="ease-out">
              {chartData.map((_, cellIdx) => {
                const mark = mergeLimitMarks(
                  catMonthMarks?.[cellIdx] ?? null,
                  isTop ? (categoryMarks?.total[cellIdx] ?? null) : null,
                );
                return (
                  <Cell
                    key={cellIdx}
                    fill={cat.color}
                    stroke={mark ? "var(--warning)" : "var(--panel)"}
                    strokeWidth={mark ? 2 : 1}
                  />
                );
              })}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Vista B — AreaChart stack de solo-gastos por categoría (Fase 1.2.2) ──────

interface FormBChartInnerProps {
  chartData: ChartDataPoint[];
  data: ReportsMovementsResponse;
  year: number;
  height: number;
  reducedMotion: boolean;
  currency: string;
  /**
   * Marcas de límite (P2 — Tramo 2): reporte.cat.gastoMesCategoria (por serie) y
   * reporte.cat.gastoMesTotal (serie top del stack). Mismo dato que Forma 2 —
   * acá se expresa como dot/ring sobre el punto de cada serie (anclaje
   * "series-point"), no como recoloreo/contorno de banda.
   */
  categoryMarks?: ByCategoryMarks;
}

/**
 * Stack único de áreas apiladas: solo gastos (categories[]).
 *
 * Un único stackId="expense" — N áreas, una por categoría de gasto.
 * La última área (top del stack) lleva stroke="var(--expense)" 2px: la línea
 * de contorno superior del stack es la línea de gasto de la Forma 1, lo que
 * garantiza continuidad visual entre vistas A y B y comunica semántica de gasto.
 * Las bandas llevan fill=category.color a opacidad 0.55 (uniforme, sin degradé).
 * Separadores 1px var(--panel) entre bandas para que colores similares no se fusionen.
 * Tooltip: reutiliza Form2Tooltip (mismo patrón que Forma 2 — solo gastos).
 */
function FormBChartInner({ chartData, data, year, height, reducedMotion, currency, categoryMarks }: FormBChartInnerProps) {
  const expenseCategories = data.categories;
  const formatYAxisTick = makeYAxisTickFormatter(currency);

  // IDs únicos para los gradientes (evitar colisión con Forma 2 si hay múltiples cards)
  const gradId = (id: string) => `fbGradE_${id.replace(/[^a-z0-9]/gi, "_")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          {/* Gradientes de gasto: fill con color de categoría a opacidad 0.55 (uniforme) */}
          {expenseCategories.map((cat) => (
            <linearGradient key={gradId(cat.categoryId)} id={gradId(cat.categoryId)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cat.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={cat.color} stopOpacity={0.55} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid horizontal vertical={false} stroke="var(--hair)" strokeWidth={1} />
        <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: "var(--muted)", fontFamily: "var(--ui)" }} interval={0} />
        <YAxis axisLine={false} tickLine={false} tickCount={5} tickFormatter={formatYAxisTick} tick={{ fontSize: 11.5, fill: "var(--muted)", fontFamily: "var(--mono)" }} width={64} />
        <Tooltip
          cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
          content={({ active, payload, label }) => (
            <Form2Tooltip
              active={active}
              payload={payload as unknown as Array<{ dataKey: string; value: number }>}
              label={label}
              data={data}
              year={year}
              currency={currency}
              categoryMarks={categoryMarks}
            />
          )}
        />

        {/* Stack de GASTO — único stackId */}
        {expenseCategories.map((cat, idx) => {
          const isTop = idx === expenseCategories.length - 1;
          const catMonthMarks = categoryMarks?.perCategory.get(cat.categoryId);
          // Mismo merge que la vista Barra: la marca de este punto es la de la
          // categoría y, si es la serie top del stack, también la del total del mes.
          const dotMarks = chartData.map((_, i) =>
            mergeLimitMarks(catMonthMarks?.[i] ?? null, isTop ? (categoryMarks?.total[i] ?? null) : null),
          );
          return (
            <Area
              key={cat.categoryId}
              type="monotone"
              dataKey={cat.categoryId}
              stackId="expense"
              stroke={isTop ? "var(--expense)" : "var(--panel)"}
              strokeWidth={isTop ? 2 : 1}
              fill={`url(#${gradId(cat.categoryId)})`}
              dot={((props: { cx?: number; cy?: number; index?: number }) =>
                renderSeriesPointMark(props, dotMarks)) as unknown as boolean}
              activeDot={isTop ? { r: 4, fill: "var(--expense)", stroke: "var(--panel)", strokeWidth: 2 } : false}
              isAnimationActive={!reducedMotion}
              animationDuration={400}
              animationEasing="ease-out"
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Stepper de año embebido per-card ─────────────────────────────────────────

interface YearStepperProps {
  year: number;
  currentYear: number;
  earliestYear: number | null;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

function YearStepper({ year, currentYear, earliestYear, onPrev, onNext, disabled }: YearStepperProps) {
  const canGoPrev = !disabled && earliestYear !== null && year > earliestYear;
  const canGoNext = !disabled && year < currentYear;

  return (
    <div
      className="flex items-center rounded-pill border border-line bg-panel shadow-[var(--shadow-sm)] p-1"
      role="group"
      aria-label="Navegación de año"
    >
      {/* ‹ Anterior */}
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

      {/* Año — mono tabular (regla dura 3: cifra de año es un número) */}
      <span
        className="mono text-[14.5px] font-semibold text-ink min-w-[52px] text-center select-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {year}
      </span>

      {/* › Siguiente */}
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

// ─── Popover de confirmación de quitar ────────────────────────────────────────

interface RemoveConfirmPopoverProps {
  onConfirm: () => void;
  onCancel: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function RemoveConfirmPopover({ onConfirm, onCancel, anchorRef }: RemoveConfirmPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
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

// ─── LegendAllChip — atajo "Todas / Ninguna" (chip-comando icónico) ──────────

/**
 * Chip-comando "Todas / Ninguna" para las leyendas de categorías.
 *
 * Spec: docs/design.md §"Leyenda interactiva" → "Atajo Todas / Ninguna" y
 *       §"Escalado de la leyenda con muchas categorías".
 *
 * - Solo aplica a leyendas de categorías (Forma 1 Vista B + Forma 2).
 * - Vive en el CARRIL FIJO debajo de la región scrolleable, FUERA del role="group".
 * - Precedido por un divisor HORIZONTAL --hair 1px (my-[8px]) que separa
 *   el área de chips del carril del comando.
 * - Si hiddenCategoryIds.length === 0 (todas activas) → "Ninguna" + EyeOff → emite [].
 * - Si hiddenCategoryIds.length > 0 (alguna apagada) → "Todas" + Eye → emite null.
 */
interface LegendAllChipProps {
  hiddenCategoryIds: string[];
  onCategoryIdsChange?: (ids: string[] | null) => void;
}

function LegendAllChip({
  hiddenCategoryIds,
  onCategoryIdsChange,
}: LegendAllChipProps) {
  const allVisible = hiddenCategoryIds.length === 0;
  const label = allVisible ? "Ninguna" : "Todas";
  const ariaLabel = allVisible
    ? "Ocultar todas las categorías"
    : "Mostrar todas las categorías";
  const Icon = allVisible ? EyeOff : Eye;

  function handleClick() {
    // Todas activas → apagar todas → []; alguna apagada → encender todas → null
    onCategoryIdsChange?.(allVisible ? [] : null);
  }

  return (
    // Subárbol: [divisor horizontal][chip]. Si el chip no se renderiza, no hay divisor.
    <>
      {/* Divisor horizontal --hair: separa el área de chips del carril del comando */}
      <div
        aria-hidden="true"
        className="my-[8px]"
        style={{ borderTop: "1px solid var(--hair)", width: "100%" }}
      />
      {/* Chip-comando: inline-flex, mismo alto/alineación que los chips de categoría */}
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        className={cn(
          "group inline-flex items-center gap-[6px] px-[8px] py-[4px] rounded-[7px]",
          "cursor-pointer transition-colors duration-[140ms]",
          "bg-panel-2 hover:bg-panel-3 active:bg-panel-3",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        {/* Ícono 13px aria-hidden — no swatch de color */}
        <Icon
          size={13}
          aria-hidden="true"
          className="shrink-0 text-muted transition-colors duration-[140ms] group-hover:text-ink"
        />
        {/* Rótulo 12px/600 neutro, select-none */}
        <span
          className={cn(
            "text-[12px] font-semibold select-none",
            "text-ink-2 group-hover:text-ink transition-colors duration-[140ms]",
          )}
        >
          {label}
        </span>
      </button>
    </>
  );
}

// ─── ReportCard — widget autónomo ─────────────────────────────────────────────

export interface ReportCardProps {
  /** Tipo de reporte. */
  type: ReportCardType;
  /** Año a mostrar. Controlado externamente. */
  year: number;
  /**
   * Categorías seleccionadas. null = todas. Controlado externamente.
   * En by-category e income-expense (footer leyenda-filtro de /reportes), la leyenda
   * togglea ítems de availableCategories y escribe en categoryIds.
   */
  categoryIds?: string[] | null;
  /** Alto del canvas en desktop (px). 280 en dashboard, 300 en /reportes. */
  chartHeight?: number;
  /**
   * Callback al cambiar de año (el widget llama aquí para que el padre persista).
   */
  onYearChange?: (year: number) => void;
  /**
   * Callback al cambiar el filtro de categorías.
   */
  onCategoryIdsChange?: (ids: string[] | null) => void;
  /**
   * Modo de visualización del gráfico de la card `by-category`.
   * "bar" (default) = barras apiladas por categoría (Forma 2 histórica).
   * "line" = stack de áreas apiladas por categoría (geometría continua).
   * Solo aplica cuando type === "by-category". Ignorado en income-expense y otros.
   */
  categoryChartMode?: "bar" | "line";
  /**
   * Callback al cambiar el modo Barra↔Línea de by-category.
   * El padre persiste (en /reportes).
   * Solo relevante cuando type === "by-category".
   */
  onCategoryChartModeChange?: (mode: "bar" | "line") => void;
  /**
   * Si se muestra el botón X para quitar la card.
   * Solo en /reportes (no en el dashboard).
   */
  removable?: boolean;
  /**
   * Callback al confirmar la eliminación de la card.
   * Solo relevante si removable=true.
   */
  onRemove?: () => void;
  /**
   * Moneda de display de esta card (Ola 3, P3).
   * undefined → usa la default global del usuario (comportamiento actual / Dashboard).
   * CurrencyCode → override local; la serie se solicita convertida a esa moneda.
   */
  currency?: CurrencyCode;
  /**
   * Callback al cambiar la moneda de la card (Ola 3, P3).
   * Cuando está presente → se monta el CardCurrencyTrigger en la cabecera.
   * Cuando está ausente (undefined) → no se monta el selector (ej. Dashboard).
   * La condición de montaje es la PRESENCIA del callback, no el flag removable.
   */
  onCurrencyChange?: (c: CurrencyCode) => void;
  /**
   * Título propio de la card (Ola 2, P4).
   * undefined → se muestra el placeholder calculado por el padre (titlePlaceholder).
   */
  title?: string;
  /**
   * Placeholder de título "Reporte N" calculado por el padre (1-based, no monotónico).
   * La card lo pasa al input nativo como placeholder y lo renderiza en idle cuando
   * no hay título propio. La numeración N la calcula el padre, no la card.
   * Default "Reporte" para uso en el dashboard (donde no hay índice ni edición).
   */
  titlePlaceholder?: string;
  /**
   * Callback al confirmar un cambio de título.
   * Recibe el título trimmeado; si queda vacío, el padre debe omitir el campo.
   * Solo se invoca desde /reportes (removable=true). En el Dashboard no aplica.
   */
  onTitleChange?: (title: string) => void;
  /**
   * Filtro de tipo de movimiento para la card `income-expense` (RF-REP-014).
   * undefined = todos los tipos (back-compat / dashboard).
   * Array con los tipos incluidos (multi-selección).
   * Solo aplica a type === "income-expense". Ignorado en otros tipos.
   */
  movementTypes?: Array<"fijo" | "cuota" | "unico">;
  /**
   * Callback al cambiar el filtro de tipo de movimiento.
   * Cuando está presente → se montan los chips en la cabecera (solo en /reportes).
   * Cuando está ausente → no se monta el control (ej. Dashboard).
   */
  onMovementTypesChange?: (types: Array<"fijo" | "cuota" | "unico">) => void;
  /**
   * Filtro de dirección para la card `income-expense` (RF-REP-014).
   * undefined / "both" = ambas direcciones (back-compat / dashboard).
   * "expense" = solo gastos; "income" = solo ingresos.
   * Solo aplica a type === "income-expense". Ignorado en otros tipos.
   */
  direction?: "expense" | "income" | "both";
  /**
   * Callback al cambiar el filtro de dirección.
   * Cuando está presente → se monta el segmented en la cabecera y la leyenda-filtro de
   * categorías en el footer (modo /reportes). La Dirección es el único control de cuántas
   * líneas muestra el canvas (no la leyenda de categorías).
   * Cuando está ausente → no se montan filtros; el footer muestra la leyenda decorativa
   * de 2 series Ingresos/Gastos (modo Dashboard).
   */
  onDirectionChange?: (dir: "expense" | "income" | "both") => void;
}

// ─── EditableTitle — título editable in-situ de la card (Ola 2, P4) ───────────

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

/**
 * Título editable in-situ de la cabecera de la card de reporte.
 * Spec: docs/design.md §"Título editable de la card de reporte (Ola 2, P4)".
 *
 * Estados:
 *  - idle (título propio o placeholder): botón con cursor:text + lápiz on-hover.
 *  - editando: input inline del DS con misma tipografía.
 *
 * La lógica de confirmar/cancelar y el estado de edición viven en ReportCard;
 * este componente es puro presentación.
 */
function EditableTitle({
  titleProp,
  titlePlaceholder,
  displayTitle,
  isEditing,
  editingValue,
  inputRef,
  onEdit,
  onCommit,
  onCancel,
  onEditingValueChange,
  canEdit,
}: EditableTitleProps) {
  if (isEditing) {
    return (
      /* ── Estado EDITANDO: input inline del DS ── */
      <input
        ref={inputRef}
        type="text"
        maxLength={60}
        value={editingValue}
        placeholder={titlePlaceholder}
        onChange={(e) => onEditingValueChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        aria-label="Título del reporte"
        className={cn(
          // Tipografía idéntica al título display (16px/600 Space Grotesk)
          "text-[16px] font-semibold leading-tight text-ink",
          // Caja del input DS: bg-panel, borde line-strong, radio r-ctl, padding compacto
          "bg-panel border border-[var(--line-strong)] rounded-[var(--r-ctl,10px)]",
          "px-[8px] py-[3px]",
          // Ancho: ocupa la zona de identidad disponible sin empujar controles
          "min-w-0 flex-1",
          // Focus ring acento (cromo de interacción)
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          // Placeholder en --faint
          "placeholder:text-[var(--faint)]",
        )}
      />
    );
  }

  return (
    /* ── Estado IDLE: botón con el texto del título (o placeholder) ── */
    <button
      type="button"
      onClick={canEdit ? onEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit();
        }
      }}
      aria-label={canEdit ? "Editar título del reporte" : undefined}
      disabled={!canEdit}
      className={cn(
        "group/title flex items-center gap-[6px] min-w-0",
        // cursor:text solo cuando es editable
        canEdit ? "cursor-text" : "cursor-default",
        // Quitamos estilos de botón nativo
        "bg-transparent border-0 p-0 text-left",
        // Focus ring acento cuando el botón recibe foco de teclado
        canEdit && "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:rounded-[var(--r-ctl,10px)]",
      )}
    >
      {/* Texto del título o placeholder */}
      <span
        title={displayTitle}
        className={cn(
          "block text-[16px] font-semibold leading-tight truncate",
          // Título propio → --ink; placeholder → --faint
          titleProp ? "text-ink" : "text-[var(--faint)]",
        )}
      >
        {displayTitle}
      </span>
      {/* Lápiz on-hover (y en focus de teclado): oculto en reposo */}
      {canEdit && (
        <Pencil
          size={14}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted",
            // Oculto en reposo; visible en hover del grupo y en focus del botón
            "opacity-0 transition-opacity duration-[140ms]",
            "group-hover/title:opacity-100 group-focus-visible/title:opacity-100",
            // prefers-reduced-motion: sin transición
            "motion-reduce:transition-none",
          )}
        />
      )}
    </button>
  );
}

// ─── CardControls — barra de controles derecha de la cabecera ─────────────────

interface CardControlsProps {
  year: number;
  currentYear: number;
  earliestYear: number | null;
  onPrev: () => void;
  onNext: () => void;
  onCurrencyChange?: (c: CurrencyCode) => void;
  effectiveCurrency: CurrencyCode;
  removable: boolean;
  removeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onRemoveOpen: () => void;
  onRefresh: () => void;
  isFetching: boolean;
}

/**
 * Barra de controles derecha de la cabecera de la card:
 * [YearStepper] [divisor] [CardCurrencySelect?] [divisor] [X?].
 * Extraído para reutilizar en los dos bloques de cabecera (by-category e income-expense).
 * Spec: docs/design.md §"Moneda por reporte — selector embebido en la cabecera de la card (Ola 3, P3)".
 */
function CardControls({
  year,
  currentYear,
  earliestYear,
  onPrev,
  onNext,
  onCurrencyChange,
  effectiveCurrency,
  removable,
  removeButtonRef,
  onRemoveOpen,
  onRefresh,
  isFetching,
}: CardControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {/* Control de año embebido (stepper pill) */}
      <YearStepper
        year={year}
        currentYear={currentYear}
        earliestYear={earliestYear}
        onPrev={onPrev}
        onNext={onNext}
      />

      {/* Selector de moneda por card (solo cuando hay callback — /reportes) */}
      {onCurrencyChange && (
        <>
          {/* Mini-divisor --hair entre stepper y selector de moneda */}
          <span
            className="block h-[16px] w-px bg-hair shrink-0"
            aria-hidden="true"
          />
          <CardCurrencySelect
            value={effectiveCurrency}
            onChange={onCurrencyChange}
          />
        </>
      )}

      {/* Divisor de entrada al clúster de utilidad (refrescar + X?) — incondicional (P5) */}
      <span
        className="block h-[16px] w-px bg-hair shrink-0"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onRefresh}
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

// ─── ReportCard — widget autónomo ─────────────────────────────────────────────

/**
 * Widget de reporte autónomo.
 * Encapsula: cabecera (identidad + stepper de año + [quitar]) + gráfico + leyenda-filtro.
 *
 * Modo persistido: año y categoryIds vienen por props; los cambios se reportan
 * via callbacks (onYearChange, onCategoryIdsChange). El padre persiste.
 *
 * La leyenda-filtro (Ola 2, P1 / RF-REP-014 rework):
 * - income-expense en /reportes (onDirectionChange presente): leyenda-filtro de categorías
 *   tildables en el footer (mismo ChartLegend que by-category). Escribe en categoryIds.
 *   La Dirección en la cabecera controla cuántas líneas hay (no la leyenda).
 * - income-expense en Dashboard (sin onDirectionChange): leyenda decorativa 2 series.
 * - by-category: leyenda-filtro de categorías en el footer → categoryIds.
 */
export function ReportCard({
  type,
  year,
  categoryIds = null,
  chartHeight = 300,
  onYearChange,
  onCategoryIdsChange,
  categoryChartMode = "bar",
  onCategoryChartModeChange,
  removable = false,
  onRemove,
  currency,
  onCurrencyChange,
  title: titleProp,
  titlePlaceholder = "Reporte",
  onTitleChange,
  movementTypes,
  onMovementTypesChange,
  direction,
  onDirectionChange,
}: ReportCardProps) {
  const reducedMotion = useReducedMotion();
  const { defaultCurrency } = useSettings();
  // P2 — Fase 1 (Tramo 2): límites del usuario (marca visual pasiva). [] = cero impacto (D9).
  const { limits } = useLimits();

  // Moneda efectiva para formatters/charts/eje Y/tooltips:
  //   - Si hay override de card (currency prop presente) → usa ese override.
  //   - Si no → usa la default global del usuario.
  // Para el param del backend se pasa `currency` tal cual (undefined si no hay override),
  // así el backend aplica la default del usuario sin param explícito (back-compat).
  const effectiveCurrency = currency ?? defaultCurrency;

  // Para la card income-expense, pasamos movementTypes y direction al hook.
  // Para otros tipos, son undefined.
  const reportsMovementTypes = type === "income-expense" ? movementTypes : undefined;
  const reportsDirection = type === "income-expense" ? direction : undefined;

  const { data, isLoading, isError, isFetching, refetch } = useReports(
    year,
    categoryIds,
    currency,
    reportsMovementTypes,
    reportsDirection,
  );

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Estado de edición del título ───────────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  /** Valor del input mientras se edita; arranca en el título actual (o vacío si no hay). */
  const [editingValue, setEditingValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  /** Abre el modo edición: inicializa el input con el título actual (o vacío). */
  function startTitleEdit() {
    if (!onTitleChange) return;
    setEditingValue(titleProp ?? "");
    setIsEditingTitle(true);
  }

  /** Confirma la edición: persiste el título trimmeado (o lo quita si vacío). */
  function commitTitleEdit() {
    if (!isEditingTitle) return;
    setIsEditingTitle(false);
    const trimmed = editingValue.trim();
    onTitleChange?.(trimmed);
  }

  /** Cancela la edición: descarta el cambio y restaura el valor previo. */
  function cancelTitleEdit() {
    setIsEditingTitle(false);
    setEditingValue(titleProp ?? "");
  }

  // Foco automático al input cuando entra a modo edición
  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
    }
  }, [isEditingTitle]);

  // Año actual (límite navegación hacia adelante)
  const [currentYear, setCurrentYear] = useState(() => {
    const now = new Date();
    return now.getFullYear();
  });
  useEffect(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
  }, []);

  const earliestYear = data?.earliestYear ?? null;
  const chartData = data ? buildChartData(data) : [];

  // Universo estable de categorías para la leyenda-filtro (P2_b).
  // Viene de availableCategories (sin aplicar filtro), no de useCategories.
  // Fallback a [] si el backend aún no envía el campo (compatibilidad transitoria).
  // Memoizado para estabilizar la referencia del array (evita re-crear callbacks en cada render).
  const availableCategories = useMemo(
    () => data?.availableCategories ?? [],
    [data?.availableCategories],
  );

  /**
   * Universo de leyenda por tipo de card (fix E2).
   * by-category: solo categorías con gasto (hasExpense === true) — no debe mostrar
   * categorías income-only.
   * income-expense: universo completo (con o sin gasto) — así las categorías de
   * ingreso aparecen en la leyenda y quedan tildadas por default.
   * Usado de forma CONSISTENTE en los ítems renderizados, el toggle y hiddenCategoryIds.
   */
  const legendUniverse = useMemo(
    () =>
      type === "by-category"
        ? availableCategories.filter((c) => c.hasExpense)
        : availableCategories,
    [availableCategories, type],
  );

  // ── Lógica de toggle de la leyenda-filtro ──────────────────────────────────

  /**
   * Toggle de categorías (Forma 1 Vista B + Forma 2).
   * Universo = legendUniverse (por tipo). Escribe en categoryIds.
   * Lógica de 3 estados: null=todas / lista=subconjunto / []=ninguna.
   *
   * Si el universo es vacío o el campo no llegó aún → no hace nada.
   */
  const handleCategoryLegendToggle = useCallback(
    (categoryId: string) => {
      if (legendUniverse.length === 0) return;
      const allIds = legendUniverse.map((c) => c.categoryId);

      // Estado actual: null = todas activas; lista = activas; [] = ninguna activa
      const currentActive: string[] =
        categoryIds === null ? allIds : categoryIds;

      const isCurrentlyActive = currentActive.includes(categoryId);

      let newIds: string[] | null;
      if (isCurrentlyActive) {
        // Apagar: remover del subconjunto activo
        const remaining = currentActive.filter((id) => id !== categoryId);
        // Si quedan todas → null (estado "todas")
        newIds = remaining.length === allIds.length ? null : remaining;
      } else {
        // Encender: agregar al subconjunto activo
        const added = [...currentActive, categoryId];
        // Si están todas → null (estado "todas")
        newIds = added.length === allIds.length ? null : added;
      }

      onCategoryIdsChange?.(newIds);
    },
    [legendUniverse, categoryIds, onCategoryIdsChange],
  );

  // ── Derivar el estado "oculto" para la leyenda ─────────────────────────────

  /**
   * Ids de categorías OCULTAS para la leyenda de categorías.
   * Si categoryIds === null → ninguna oculta (todas visibles).
   * Si categoryIds es lista → las que NO están en la lista son las ocultas.
   */
  const hiddenCategoryIds: string[] = (() => {
    if (categoryIds === null) return [];
    const activeSet = new Set(categoryIds);
    return legendUniverse
      .filter((c) => !activeSet.has(c.categoryId))
      .map((c) => c.categoryId);
  })();

  // Vacío (sin movimientos en el año para esta forma).
  // En income-expense la Dirección controla qué series se consideran;
  // ya no hay hiddenSeries que modifique este cálculo.
  const isYearEmpty = (() => {
    if (!data) return false;
    if (type === "income-expense") {
      if (direction === "expense") {
        return data.months.every((m) => m.expenseCents === 0);
      }
      if (direction === "income") {
        return data.months.every((m) => m.incomeCents === 0);
      }
      // direction = "both" o undefined: ambas series deben estar vacías
      return data.months.every((m) => m.incomeCents === 0 && m.expenseCents === 0);
    }
    return data.months.every((m) => m.expenseCents === 0);
  })();

  function handlePrev() {
    if (earliestYear !== null && year > earliestYear) {
      const newYear = year - 1;
      onYearChange?.(newYear);
    }
  }

  function handleNext() {
    if (year < currentYear) {
      const newYear = year + 1;
      onYearChange?.(newYear);
    }
  }

  /**
   * Cambia la dirección de cómputo (RF-REP-014 §5).
   * La Dirección es el único control de cuántas líneas muestra el canvas;
   * la leyenda-filtro de categorías en el footer NO controla visibilidad de series.
   */
  function handleDirectionChange(dir: "expense" | "income" | "both") {
    onDirectionChange?.(dir);
  }

  // Título display de la card: el título propio si existe, o el placeholder "Reporte N".
  const displayTitle = titleProp ?? titlePlaceholder;

  // ── Ítems de leyenda ──────────────────────────────────────────────────────

  /**
   * Ítems de leyenda para by-category e income-expense en /reportes (modo interactivo).
   * Generados desde legendUniverse (universo por tipo, ver fix E2 arriba).
   * La misma estructura sirve a ambos tipos de card; solo cambia el header que los llama.
   */
  const legendItemsByCategory = legendUniverse.map((cat) => ({
    id: cat.categoryId,
    color: cat.color,
    label: cat.name,
  }));

  // ── P2 — Fase 1 (Tramo 2): marca visual pasiva de límites ─────────────────
  // income-expense: reporte.ie.gastoMes / .ingresoMes, un valor por mes de la serie.
  // by-category: reporte.cat.gastoMesCategoria (por banda) / .gastoMesTotal (stack).
  // Con `limits` vacío, evaluateLimits siempre null → cero impacto (restricción rectora).
  const incomeExpenseMarks =
    type === "income-expense" && data
      ? computeIncomeExpenseMarks(
          limits,
          year,
          data.months.map((m) => m.expenseCents),
          data.months.map((m) => m.incomeCents),
        )
      : undefined;

  const byCategoryMarks =
    type === "by-category" && data
      ? computeByCategoryMarks(
          limits,
          year,
          data.categories,
          data.months.map((m) => m.expenseCents),
        )
      : undefined;

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade"
      aria-label={`${displayTitle} ${year}`}
    >
      {/* ── Cabecera de la card ── */}
      {/*
        Spec visual: docs/design.md §"Título editable de la card de reporte (Ola 2, P4)"
        y §"Toggle Barra ↔ Línea en la card by-category".

        income-expense (Total-only, amplio ≥--bp-wide):
          Fila única flex justify-between:
            Izq: [título editable]
            Der: [stepper · moneda · X]
          Compacto (<--bp-wide): wrap natural — controles bajan a segunda línea.

        by-category (con toggle Barra/Línea, amplio ≥--bp-wide):
          Línea 1 (ancho completo): [título editable]
          Línea 2 flex justify-between: [ViewTabs Barra/Línea izq] / [stepper · moneda · X der]
            items-start para alinear los controles al tope de la columna identidad.
          Compacto (<--bp-wide): wrap natural — orden vertical: [título] → [tabs] → [controles].
      */}

      {/* ── BLOQUE income-expense ──────────────────────────────────────────────────
          Con filtros (onDirectionChange presente = /reportes): molde dos líneas de by-category.
            Línea 1 (mb-[8px]): título editable (ancho completo).
            Línea 2 (flex flex-wrap justify-between gap-x-4 gap-y-2 mb-[18px]):
              Cluster izq: [Dirección] [divisor] [Tipos]
              Cluster der:  CardControls sin cambios
          Sin filtros (dashboard): fila única igual que antes.
          La leyenda-filtro de categorías va en el FOOTER (no en la cabecera): ver §Leyendas.
      ── */}
      {type === "income-expense" && (
        onDirectionChange ? (
          /* ── Con filtros: layout de 2 líneas (RF-REP-014) ── */
          <>
            {/* Línea 1: título editable + ícono Info de límites (ancho completo) */}
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
              {/* Popover informativo de límites (P2) — solo en /reportes (con filtros = no Dashboard) */}
              <LimitsInfoPopover surface="reporte-income-expense" />
            </div>
            {/* Línea 2: cluster de filtros (izq) + CardControls (der) */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
              {/* Cluster izquierdo — filtros de cómputo */}
              <div className="flex flex-wrap items-center gap-[6px]">
                {/* §2 Dirección — segmented 3 opciones */}
                <DirectionSegmented
                  value={direction ?? "both"}
                  onChange={handleDirectionChange}
                />
                {/* Divisor --hair entre Dirección y Tipo */}
                <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
                {/* §3 Tipo de movimiento — 3 chips multi-selección */}
                <MovementTypeChips
                  value={movementTypes ?? ["fijo", "cuota", "unico"]}
                  onChange={(types) => onMovementTypesChange?.(types)}
                />
                {/* Categoría ya NO tiene control en la cabecera — está en el footer como leyenda-filtro */}
              </div>
              {/* Cluster derecho — CardControls */}
              <CardControls
                year={year}
                currentYear={currentYear}
                earliestYear={earliestYear}
                onPrev={handlePrev}
                onNext={handleNext}
                onCurrencyChange={onCurrencyChange}
                effectiveCurrency={effectiveCurrency}
                removable={removable}
                removeButtonRef={removeButtonRef}
                onRemoveOpen={() => setRemoveOpen((o) => !o)}
                onRefresh={() => refetch()}
                isFetching={isFetching}
              />
            </div>
          </>
        ) : (
          /* ── Sin filtros (dashboard): fila única igual que antes ── */
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
            {/* Identidad: solo el título editable (izquierda) */}
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
            {/* Controles: stepper + moneda + X (derecha) */}
            <CardControls
              year={year}
              currentYear={currentYear}
              earliestYear={earliestYear}
              onPrev={handlePrev}
              onNext={handleNext}
              onCurrencyChange={onCurrencyChange}
              effectiveCurrency={effectiveCurrency}
              removable={removable}
              removeButtonRef={removeButtonRef}
              onRemoveOpen={() => setRemoveOpen((o) => !o)}
              onRefresh={() => refetch()}
              isFetching={isFetching}
            />
          </div>
        )
      )}

      {/* ── BLOQUE by-category: línea 1 (título) + línea 2 (tabs + controles) ── */}
      {type === "by-category" && (
        <>
          {/* Línea 1: título editable + ícono Info de límites (ancho completo) */}
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
            {/* Popover informativo de límites (P2) — by-category nunca vive en Dashboard */}
            <LimitsInfoPopover surface="reporte-by-category" />
          </div>
          {/* Línea 2: [ViewTabs Barra/Línea izq] / [controles der], items-start */}
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-[18px]">
            <ViewTabs
              tabs={BY_CATEGORY_TABS}
              value={categoryChartMode}
              onChange={(v) => onCategoryChartModeChange?.(v)}
              panelId={CHART_PANEL_ID}
              ariaLabel="Representación del reporte"
            />
            <CardControls
              year={year}
              currentYear={currentYear}
              earliestYear={earliestYear}
              onPrev={handlePrev}
              onNext={handleNext}
              onCurrencyChange={onCurrencyChange}
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
        <ChartError height={chartHeight} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ChartSkeleton height={chartHeight} />
      ) : (
        <div
          id={CHART_PANEL_ID}
          role="tabpanel"
          className="relative"
          {...(type === "by-category"
            ? {
                "aria-labelledby":
                  categoryChartMode === "line" ? "tab-linea" : "tab-barra",
              }
            : {})}
        >
          {isYearEmpty && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              aria-live="polite"
            >
              <p className="text-[14px] text-muted">Sin movimientos en {year}.</p>
            </div>
          )}

          <ChartResponsiveArea desktopHeight={chartHeight}>
            {(height) => {
              if (type === "income-expense") {
                return (
                  <Form1ChartInner
                    chartData={chartData}
                    year={year}
                    height={height}
                    reducedMotion={reducedMotion}
                    currency={effectiveCurrency}
                    direction={direction}
                    expenseMarks={incomeExpenseMarks?.expense}
                    incomeMarks={incomeExpenseMarks?.income}
                  />
                );
              }
              // by-category — modo Línea
              if (type === "by-category" && categoryChartMode === "line") {
                return (
                  <FormBChartInner
                    chartData={chartData}
                    data={data}
                    year={year}
                    height={height}
                    reducedMotion={reducedMotion}
                    currency={effectiveCurrency}
                    categoryMarks={byCategoryMarks}
                  />
                );
              }
              // by-category — modo Barra (default)
              return (
                <Form2ChartInner
                  chartData={chartData}
                  data={data}
                  year={year}
                  height={height}
                  reducedMotion={reducedMotion}
                  currency={effectiveCurrency}
                  categoryMarks={byCategoryMarks}
                />
              );
            }}
          </ChartResponsiveArea>

          {/* ─ Leyendas ─ */}

          {/* income-expense en /reportes (onDirectionChange presente):
              leyenda-filtro de categorías en el footer (RF-REP-014 §4 rework).
              Misma estructura que by-category: ChartLegend interactivo con LegendAllChip y scroll.
              La Dirección en cabecera controla cuántas líneas hay; la leyenda filtra por categoría.
              Solo se muestra cuando hay categorías disponibles en el año/filtros actuales. */}
          {data && type === "income-expense" && onDirectionChange && legendUniverse.length > 0 && (
            <ChartLegend
              items={legendItemsByCategory}
              hiddenIds={hiddenCategoryIds}
              onToggle={handleCategoryLegendToggle}
              groupLabel="Filtrar categorías"
              scrollable
              commandSlot={
                <LegendAllChip
                  hiddenCategoryIds={hiddenCategoryIds}
                  onCategoryIdsChange={onCategoryIdsChange}
                />
              }
            />
          )}

          {/* income-expense en Dashboard (sin onDirectionChange):
              leyenda DECORATIVA de 2 series (Ingresos/Gastos) — no interactiva, no filtro.
              El Dashboard no monta filtros de Dirección/Tipo/Categoría ni toggle de proyección.
              Conserva la estética histórica del widget de dashboard. */}
          {data && type === "income-expense" && !onDirectionChange && (
            <ChartLegend
              items={[
                { id: "income", color: "var(--income)", label: "Ingresos" },
                { id: "expense", color: "var(--expense)", label: "Gastos" },
              ]}
            />
          )}

          {/* by-category (modos Barra y Línea): leyenda de categorías idéntica en ambos modos. */}
          {data && type === "by-category" && legendUniverse.length > 0 && (
            <ChartLegend
              items={legendItemsByCategory}
              hiddenIds={hiddenCategoryIds}
              onToggle={handleCategoryLegendToggle}
              groupLabel="Filtrar categorías"
              scrollable
              commandSlot={
                <LegendAllChip
                  hiddenCategoryIds={hiddenCategoryIds}
                  onCategoryIdsChange={onCategoryIdsChange}
                />
              }
            />
          )}
        </div>
      )}

      {/* ── Popovers (portaled a body) ── */}
      {removeOpen && removable && (
        <RemoveConfirmPopover
          onConfirm={() => {
            setRemoveOpen(false);
            onRemove?.();
          }}
          onCancel={() => setRemoveOpen(false)}
          anchorRef={removeButtonRef}
        />
      )}
    </div>
  );
}
