"use client";

/**
 * Widget de reporte autónomo — Pantalla 8 (RF-REP-001/002, Fase 1.1.5).
 *
 * Export principal:
 *   - ReportCard: widget autónomo que engloba controles + gráfico.
 *     Acepta tipo (income-expense / by-category), año, categoryIds, callbacks.
 *
 * Spec visual: docs/design.md, sección "Reportes configurables — spec visual (Fase 1.1.5)".
 *
 * prefers-reduced-motion: isAnimationActive={false} cuando está activo.
 */

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { useReports } from "@/hooks/use-reports";
import { useCategories } from "@/hooks/use-categories";
import { formatCurrency } from "@/lib/format";
import { ChartTooltipContent } from "@/components/ui/chart";
import { ChartLegend } from "@/components/ui/chart";
import { CategoryFilterPopover, FilterButton } from "@/components/ui/category-filter";
import type { ReportsMovementsResponse, ReportCardType } from "@/types/reports";
import { cn } from "@/lib/utils";

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

function formatYAxisTick(valueCents: number): string {
  const pesos = valueCents / 100;
  if (pesos === 0) return "$0";
  if (pesos >= 1_000_000) {
    const m = pesos / 1_000_000;
    const label = m % 1 === 0 ? String(m) : m.toFixed(1).replace(".", ",");
    return `$${label}M`;
  }
  if (pesos >= 1_000) {
    const k = pesos / 1_000;
    const label = k % 1 === 0 ? String(k) : k.toFixed(1).replace(".", ",");
    return `$${label}k`;
  }
  return `$${pesos}`;
}

// ─── Tipos de datos del chart ──────────────────────────────────────────────────

interface ChartDataPoint {
  monthIndex: number;
  shortLabel: string;
  fullLabel: string;
  incomeCents: number;
  expenseCents: number;
  [key: string]: number | string;
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
}

function Form1Tooltip({ active, payload, label, year }: Form1TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const labelStr = String(label ?? "");
  const monthIndex = MONTH_LABELS_SHORT.indexOf(labelStr);
  if (monthIndex === -1) return null;
  const fullLabel = `${MONTH_LABELS_FULL[monthIndex] ?? label} ${year}`;
  const incomeVal = payload.find((p) => p.dataKey === "incomeCents")?.value ?? 0;
  const expenseVal = payload.find((p) => p.dataKey === "expenseCents")?.value ?? 0;
  const rows = [
    { color: "var(--income)", label: "Ingresos", formattedValue: formatCurrency(incomeVal), valueColor: "var(--income-ink)" },
    { color: "var(--expense)", label: "Gastos", formattedValue: formatCurrency(expenseVal), valueColor: "var(--expense-ink)" },
  ];
  return <ChartTooltipContent monthLabel={fullLabel} rows={rows} />;
}

// ─── Tooltip — Forma 2 ────────────────────────────────────────────────────────

interface Form2TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string | number;
  data: ReportsMovementsResponse;
  year: number;
}

function Form2Tooltip({ active, payload, label, data, year }: Form2TooltipProps) {
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
      formattedValue: formatCurrency(cat.monthlyExpenseCents[monthIndex] ?? 0),
      valueColor: "var(--ink)",
    }));
  const totalCents = data.months[monthIndex]?.expenseCents ?? 0;
  const totalRow = { color: "var(--expense)", label: "Total gastos", formattedValue: formatCurrency(totalCents), valueColor: "var(--expense-ink)" };
  return <ChartTooltipContent monthLabel={fullLabel} rows={catRows} totalRow={totalRow} />;
}

// ─── Toggle de vista — tabs underline neutras (Fase 1.2.2) ──────────────────

const VIEW_TABS = [
  { label: "Total", val: false, id: "tab-total" },
  { label: "Por categoría", val: true, id: "tab-porcategoria" },
] as const;

interface ViewTabsProps {
  value: boolean; // false = "Total", true = "Por categoría"
  onChange: (v: boolean) => void;
  panelId: string;
}

function ViewTabs({ value, onChange, panelId }: ViewTabsProps) {
  // Underline deslizante: mide los botones del tab activo para posicionar el indicador.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([null, null]);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const reducedMotionTabs = useReducedMotion();

  const selectedIndex = value ? 1 : 0;

  useEffect(() => {
    const btn = tabRefs.current[selectedIndex];
    if (!btn) return;
    setUnderline({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(idx === 0);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(idx === 1);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Vista del reporte"
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
      {VIEW_TABS.map((tab, i) => {
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

// ID del panel de gráfico (para aria-controls de tabs)
const CHART_PANEL_ID = "report-chart-panel";

// (FormBTooltip y TooltipCategoryBlock eliminados en Fase 1.2.2 — Vista B usa Form2Tooltip directamente)

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div>
      <div className="animate-pulse rounded-ctl bg-panel-3" style={{ height }} aria-hidden="true" />
      <div className="mt-[14px] flex gap-4">
        {[70, 56, 80].map((w, i) => (
          <div key={i} className="animate-pulse rounded-chip bg-panel-3" style={{ width: w, height: 14 }} aria-hidden="true" />
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
  return (
    <>
      <div className="[@media(max-width:940px)]:hidden" style={{ height: desktopHeight }}>
        {children(desktopHeight)}
      </div>
      <div className="[@media(min-width:941px)]:hidden" style={{ height: 220 }}>
        {children(220)}
      </div>
    </>
  );
}

// ─── Forma 1 — AreaChart interno ──────────────────────────────────────────────

interface Form1ChartInnerProps {
  chartData: ChartDataPoint[];
  year: number;
  height: number;
  reducedMotion: boolean;
}

function Form1ChartInner({ chartData, year, height, reducedMotion }: Form1ChartInnerProps) {
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
            <Form1Tooltip active={active} payload={payload as unknown as Array<{ dataKey: string; value: number }>} label={label} year={year} />
          )}
        />
        <Area type="monotone" dataKey="expenseCents" stroke="var(--expense)" strokeWidth={2} fill="url(#areaExpenseRep)" dot={false} activeDot={{ r: 4, fill: "var(--expense)", stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={!reducedMotion} animationDuration={400} animationEasing="ease-out" />
        <Area type="monotone" dataKey="incomeCents" stroke="var(--income)" strokeWidth={2} fill="url(#areaIncomeRep)" dot={false} activeDot={{ r: 4, fill: "var(--income)", stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={!reducedMotion} animationDuration={400} animationEasing="ease-out" />
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
}

function Form2ChartInner({ chartData, data, year, height, reducedMotion }: Form2ChartInnerProps) {
  const categories = data.categories;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="27%">
        <CartesianGrid horizontal vertical={false} stroke="var(--hair)" strokeWidth={1} />
        <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: "var(--muted)", fontFamily: "var(--ui)" }} interval={0} />
        <YAxis axisLine={false} tickLine={false} tickCount={5} tickFormatter={formatYAxisTick} tick={{ fontSize: 11.5, fill: "var(--muted)", fontFamily: "var(--mono)" }} width={64} />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)", fillOpacity: 0.5 }}
          content={({ active, payload, label }) => (
            <Form2Tooltip active={active} payload={payload as unknown as Array<{ dataKey: string; value: number }>} label={label} data={data} year={year} />
          )}
        />
        {categories.map((cat, idx) => {
          const isTop = idx === categories.length - 1;
          return (
            <Bar key={cat.categoryId} dataKey={cat.categoryId} stackId="categories" fill={cat.color} stroke="var(--panel)" strokeWidth={1} radius={isTop ? [7, 7, 0, 0] : [0, 0, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={400} animationEasing="ease-out">
              {chartData.map((_, cellIdx) => (
                <Cell key={cellIdx} fill={cat.color} />
              ))}
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
function FormBChartInner({ chartData, data, year, height, reducedMotion }: FormBChartInnerProps) {
  const expenseCategories = data.categories;

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
            />
          )}
        />

        {/* Stack de GASTO — único stackId */}
        {expenseCategories.map((cat, idx) => {
          const isTop = idx === expenseCategories.length - 1;
          return (
            <Area
              key={cat.categoryId}
              type="monotone"
              dataKey={cat.categoryId}
              stackId="expense"
              stroke={isTop ? "var(--expense)" : "var(--panel)"}
              strokeWidth={isTop ? 2 : 1}
              fill={`url(#${gradId(cat.categoryId)})`}
              dot={false}
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

// ─── ReportCard — widget autónomo ─────────────────────────────────────────────

export interface ReportCardProps {
  /** Tipo de reporte. */
  type: ReportCardType;
  /** Año a mostrar. Controlado externamente. */
  year: number;
  /**
   * Categorías seleccionadas. null = todas. Controlado externamente.
   * Solo aplica si isEphemeral === false (modo persistido) para que el estado
   * venga de props; en modo efímero se gestiona internamente.
   */
  categoryIds?: string[] | null;
  /** Alto del canvas en desktop (px). 280 en dashboard, 300 en /reportes. */
  chartHeight?: number;
  /**
   * Callback al cambiar de año (el widget llama aquí para que el padre persista).
   * No aplica en modo efímero.
   */
  onYearChange?: (year: number) => void;
  /**
   * Callback al cambiar el filtro de categorías.
   * No aplica en modo efímero.
   */
  onCategoryIdsChange?: (ids: string[] | null) => void;
  /**
   * Modo de visualización de la card income-expense.
   * false (default) = vista "Total" (áreas superpuestas, vista A).
   * true = vista "Por categoría" (doble stack apilado, vista B).
   * Solo aplica cuando type === "income-expense". Ignorado en by-category.
   */
  categoryBreakdown?: boolean;
  /**
   * Callback al cambiar el modo de visualización (toggle Total / Por categoría).
   * El padre persiste (en /reportes) o gestiona efímero (dashboard).
   */
  onCategoryBreakdownChange?: (v: boolean) => void;
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
}

/**
 * Widget de reporte autónomo.
 * Encapsula: cabecera (identidad + stepper de año + filtro + [quitar]) + gráfico.
 *
 * Modo persistido: año y categoryIds vienen por props; los cambios se reportan
 * via callbacks (onYearChange, onCategoryIdsChange). El padre persiste.
 *
 * No tiene "modo efímero" propio — el padre que lo use en el dashboard simplemente
 * gestiona estado local sin persistir (el widget no distingue; recibe props).
 */
export function ReportCard({
  type,
  year,
  categoryIds = null,
  chartHeight = 300,
  onYearChange,
  onCategoryIdsChange,
  categoryBreakdown = false,
  onCategoryBreakdownChange,
  removable = false,
  onRemove,
}: ReportCardProps) {
  const reducedMotion = useReducedMotion();
  const { data, isLoading, isError, refetch } = useReports(year, categoryIds);
  const { categories: allCategories } = useCategories();
  const totalCategories = allCategories?.length ?? 0;

  const [filterOpen, setFilterOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);

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

  // Vacío (sin movimientos en el año para esta forma)
  const isYearEmpty =
    data !== undefined &&
    (type === "income-expense"
      ? data.months.every((m) => m.incomeCents === 0 && m.expenseCents === 0)
      : data.months.every((m) => m.expenseCents === 0));

  // Para la vista B: el título es el mismo ("Ingresos y gastos") pero el modo cambia
  const isViewB = type === "income-expense" && categoryBreakdown;

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

  const handleCategoryChange = useCallback(
    (ids: string[] | null) => {
      onCategoryIdsChange?.(ids);
    },
    [onCategoryIdsChange]
  );

  // Título y eyebrow de la card según tipo
  const title = type === "income-expense" ? "Ingresos y gastos" : "Por categoría";

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade"
      aria-label={`${title} ${year}`}
    >
      {/* ── Cabecera de la card ── */}
      {/*
        Layout responsive:
        ≥941px: fila única flex justify-between — tabs a la izq, controles a la der.
        ≤940px: wrap natural — tabs ocupan toda la línea primero, controles en la segunda.
        Las tabs solo aparecen en income-expense; en by-category la cabecera queda igual que antes.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
        {/* Izquierda: tabs de vista (income-expense) o identidad (by-category) */}
        {type === "income-expense" ? (
          <ViewTabs
            value={categoryBreakdown}
            onChange={(v) => onCategoryBreakdownChange?.(v)}
            panelId={CHART_PANEL_ID}
          />
        ) : (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
              Reporte
            </p>
            <p className="text-[16px] font-semibold leading-tight mt-[3px] text-ink">
              {title}
            </p>
          </div>
        )}

        {/* Derecha: controles (stepper + filtro + quitar) */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Control de año embebido (stepper pill) */}
          <YearStepper
            year={year}
            currentYear={currentYear}
            earliestYear={earliestYear}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          {/* Botón filtro de categorías */}
          <FilterButton
            selectedIds={categoryIds}
            totalCategories={totalCategories}
            isOpen={filterOpen}
            buttonRef={filterButtonRef}
            onClick={() => {
              setFilterOpen((o) => !o);
              setRemoveOpen(false);
            }}
          />

          {/* Divisor y botón quitar (solo en /reportes) */}
          {removable && (
            <>
              {/* Mini-divisor --hair entre filtro y X */}
              <span
                className="block h-[16px] w-px bg-hair shrink-0"
                aria-hidden="true"
              />
              <button
                ref={removeButtonRef}
                type="button"
                onClick={() => {
                  setRemoveOpen((o) => !o);
                  setFilterOpen(false);
                }}
                aria-label="Quitar reporte"
                className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Área del gráfico ── */}
      {isError ? (
        <ChartError height={chartHeight} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ChartSkeleton height={chartHeight} />
      ) : (
        <div
          className="relative"
          {...(type === "income-expense" ? {
            id: CHART_PANEL_ID,
            role: "tabpanel" as const,
            "aria-labelledby": categoryBreakdown ? "tab-porcategoria" : "tab-total",
          } : {})}
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
              if (type === "income-expense" && !categoryBreakdown) {
                return (
                  <Form1ChartInner
                    chartData={chartData}
                    year={year}
                    height={height}
                    reducedMotion={reducedMotion}
                  />
                );
              }
              if (type === "income-expense" && categoryBreakdown) {
                return (
                  <FormBChartInner
                    chartData={chartData}
                    data={data}
                    year={year}
                    height={height}
                    reducedMotion={reducedMotion}
                  />
                );
              }
              return (
                <Form2ChartInner
                  chartData={chartData}
                  data={data}
                  year={year}
                  height={height}
                  reducedMotion={reducedMotion}
                />
              );
            }}
          </ChartResponsiveArea>

          {/* Leyenda — Vista A (income-expense, Total): Ingresos / Gastos */}
          {data && type === "income-expense" && !isViewB && (
            <ChartLegend
              items={[
                { color: "var(--income)", label: "Ingresos" },
                { color: "var(--expense)", label: "Gastos" },
              ]}
            />
          )}

          {/* Leyenda — Vista B (income-expense, Por categoría): grupo plano de categorías de gasto */}
          {data && isViewB && data.categories.length > 0 && (
            <ChartLegend
              items={data.categories.map((cat) => ({
                color: cat.color,
                label: cat.name,
              }))}
            />
          )}

          {/* Leyenda — Forma 2 (by-category): categorías de gasto */}
          {data && type === "by-category" && data.categories.length > 0 && (
            <ChartLegend
              items={data.categories.map((cat) => ({
                color: cat.color,
                label: cat.name,
              }))}
            />
          )}
        </div>
      )}

      {/* ── Popovers (portaled a body) ── */}
      {filterOpen && (
        <CategoryFilterPopover
          selectedIds={categoryIds ?? null}
          onSelectionChange={(ids) => {
            handleCategoryChange(ids);
          }}
          onClose={() => setFilterOpen(false)}
          anchorRef={filterButtonRef}
        />
      )}

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
