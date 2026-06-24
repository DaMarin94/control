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
 *   - Toggle Ingresos/Gastos persistido (hiddenSeries) en vista "Total" de income-expense.
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
} from "lucide-react";
import { useReports } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
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
  currency: string;
  hiddenSeries: Array<"income" | "expense">;
}

function Form1Tooltip({ active, payload, label, year, currency, hiddenSeries }: Form1TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const labelStr = String(label ?? "");
  const monthIndex = MONTH_LABELS_SHORT.indexOf(labelStr);
  if (monthIndex === -1) return null;
  const fullLabel = `${MONTH_LABELS_FULL[monthIndex] ?? label} ${year}`;
  const rows = [
    ...(!hiddenSeries.includes("income")
      ? [{
          color: "var(--income)",
          label: "Ingresos",
          formattedValue: formatCurrency(payload.find((p) => p.dataKey === "incomeCents")?.value ?? 0, currency),
          valueColor: "var(--income-ink)",
        }]
      : []),
    ...(!hiddenSeries.includes("expense")
      ? [{
          color: "var(--expense)",
          label: "Gastos",
          formattedValue: formatCurrency(payload.find((p) => p.dataKey === "expenseCents")?.value ?? 0, currency),
          valueColor: "var(--expense-ink)",
        }]
      : []),
  ];
  if (rows.length === 0) return null;
  return <ChartTooltipContent monthLabel={fullLabel} rows={rows} />;
}

// ─── Tooltip — Forma 2 ────────────────────────────────────────────────────────

interface Form2TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string | number;
  data: ReportsMovementsResponse;
  year: number;
  currency: string;
}

function Form2Tooltip({ active, payload, label, data, year, currency }: Form2TooltipProps) {
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
  currency: string;
  /** Series ocultas — no se renderizan en el chart. */
  hiddenSeries: Array<"income" | "expense">;
}

function Form1ChartInner({ chartData, year, height, reducedMotion, currency, hiddenSeries }: Form1ChartInnerProps) {
  const formatYAxisTick = makeYAxisTickFormatter(currency);
  const showIncome = !hiddenSeries.includes("income");
  const showExpense = !hiddenSeries.includes("expense");
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
              hiddenSeries={hiddenSeries}
            />
          )}
        />
        {/* Gastos primero (debajo), ingresos encima — spec design.md */}
        {showExpense && (
          <Area type="monotone" dataKey="expenseCents" stroke="var(--expense)" strokeWidth={2} fill="url(#areaExpenseRep)" dot={false} activeDot={{ r: 4, fill: "var(--expense)", stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={!reducedMotion} animationDuration={400} animationEasing="ease-out" />
        )}
        {showIncome && (
          <Area type="monotone" dataKey="incomeCents" stroke="var(--income)" strokeWidth={2} fill="url(#areaIncomeRep)" dot={false} activeDot={{ r: 4, fill: "var(--income)", stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={!reducedMotion} animationDuration={400} animationEasing="ease-out" />
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
}

function Form2ChartInner({ chartData, data, year, height, reducedMotion, currency }: Form2ChartInnerProps) {
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
            <Form2Tooltip active={active} payload={payload as unknown as Array<{ dataKey: string; value: number }>} label={label} data={data} year={year} currency={currency} />
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
  currency: string;
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
function FormBChartInner({ chartData, data, year, height, reducedMotion, currency }: FormBChartInnerProps) {
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
   * En los casos de categorías (Forma 1 Vista B + Forma 2), la leyenda togglea
   * ítems de availableCategories y escribe en categoryIds.
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
   * Modo de visualización de la card income-expense.
   * false (default) = vista "Total" (áreas superpuestas, vista A).
   * true = vista "Por categoría" (stack apilado, vista B).
   * Solo aplica cuando type === "income-expense". Ignorado en by-category.
   */
  categoryBreakdown?: boolean;
  /**
   * Callback al cambiar el modo de visualización (toggle Total / Por categoría).
   * El padre persiste (en /reportes) o gestiona efímero (dashboard).
   */
  onCategoryBreakdownChange?: (v: boolean) => void;
  /**
   * Series ocultas en la vista "Total" de income-expense (vista A).
   * Persistido en ReportCardConfig.hiddenSeries.
   * undefined / [] = ambas visibles (default).
   * Solo aplica a type === "income-expense" && !categoryBreakdown.
   */
  hiddenSeries?: Array<"income" | "expense">;
  /**
   * Callback al togglear una serie en la vista "Total" de income-expense.
   * Recibe el array actualizado de series ocultas.
   */
  onHiddenSeriesChange?: (hidden: Array<"income" | "expense">) => void;
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

      {/* Divisor y botón quitar (solo en /reportes) */}
      {removable && (
        <>
          {/* Mini-divisor --hair entre moneda/stepper y X */}
          <span
            className="block h-[16px] w-px bg-hair shrink-0"
            aria-hidden="true"
          />
          <button
            ref={removeButtonRef}
            type="button"
            onClick={onRemoveOpen}
            aria-label="Quitar reporte"
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── ReportCard — widget autónomo ─────────────────────────────────────────────

/**
 * Widget de reporte autónomo.
 * Encapsula: cabecera (identidad + stepper de año + [quitar]) + gráfico + leyenda-filtro.
 *
 * Modo persistido: año, categoryIds e hiddenSeries vienen por props; los cambios se reportan
 * via callbacks (onYearChange, onCategoryIdsChange, onHiddenSeriesChange). El padre persiste.
 *
 * La leyenda-filtro (Ola 2, P1) reemplaza al FilterButton + CategoryFilterPopover.
 * - Forma 1 Total: togglea series income/expense → hiddenSeries persistido.
 * - Forma 1 Por cat + Forma 2: togglea categorías de availableCategories → categoryIds.
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
  hiddenSeries = [],
  onHiddenSeriesChange,
  removable = false,
  onRemove,
  currency,
  onCurrencyChange,
  title: titleProp,
  titlePlaceholder = "Reporte",
  onTitleChange,
}: ReportCardProps) {
  const reducedMotion = useReducedMotion();
  const { defaultCurrency } = useSettings();

  // Moneda efectiva para formatters/charts/eje Y/tooltips:
  //   - Si hay override de card (currency prop presente) → usa ese override.
  //   - Si no → usa la default global del usuario.
  // Para el param del backend se pasa `currency` tal cual (undefined si no hay override),
  // así el backend aplica la default del usuario sin param explícito (back-compat).
  const effectiveCurrency = currency ?? defaultCurrency;

  const { data, isLoading, isError, refetch } = useReports(year, categoryIds, currency);

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

  // ── Lógica de toggle de la leyenda-filtro ──────────────────────────────────

  /**
   * Toggle de categorías (Forma 1 Vista B + Forma 2).
   * Universo = availableCategories. Escribe en categoryIds.
   * Lógica de 3 estados: null=todas / lista=subconjunto / []=ninguna.
   *
   * Si el universo es vacío o el campo no llegó aún → no hace nada.
   */
  const handleCategoryLegendToggle = useCallback(
    (categoryId: string) => {
      if (availableCategories.length === 0) return;
      const allIds = availableCategories.map((c) => c.categoryId);

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
    [availableCategories, categoryIds, onCategoryIdsChange],
  );

  /**
   * Toggle de series income/expense (Forma 1 Total).
   * Escribe en hiddenSeries persistido.
   */
  const handleSeriesLegendToggle = useCallback(
    (seriesId: string) => {
      const id = seriesId as "income" | "expense";
      const currentHidden = hiddenSeries ?? [];
      const isHidden = currentHidden.includes(id);
      const newHidden: Array<"income" | "expense"> = isHidden
        ? currentHidden.filter((s) => s !== id)
        : [...currentHidden, id];
      onHiddenSeriesChange?.(newHidden);
    },
    [hiddenSeries, onHiddenSeriesChange],
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
    return availableCategories
      .filter((c) => !activeSet.has(c.categoryId))
      .map((c) => c.categoryId);
  })();

  // Vacío (sin movimientos en el año para esta forma)
  // En vista "Total" con series ocultas: si ambas están ocultas → empty también.
  const isYearEmpty = (() => {
    if (!data) return false;
    if (type === "income-expense" && !categoryBreakdown) {
      // Si ambas series ocultas → empty visual
      if (hiddenSeries.includes("income") && hiddenSeries.includes("expense")) {
        return true;
      }
      return data.months.every((m) => {
        const incomeZero = hiddenSeries.includes("income") || m.incomeCents === 0;
        const expenseZero = hiddenSeries.includes("expense") || m.expenseCents === 0;
        return incomeZero && expenseZero;
      });
    }
    return data.months.every((m) => m.expenseCents === 0);
  })();

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

  // Título display de la card: el título propio si existe, o el placeholder "Reporte N".
  const displayTitle = titleProp ?? titlePlaceholder;

  // ── Ítems de leyenda según caso ────────────────────────────────────────────

  /**
   * Caso A: Forma 1, modo "Total" — dos ítems: Ingresos / Gastos.
   * Toggle persistido en hiddenSeries.
   */
  const legendItemsTotalF1 = [
    { id: "income", color: "var(--income)", label: "Ingresos" },
    { id: "expense", color: "var(--expense)", label: "Gastos" },
  ];

  /**
   * Caso B: Forma 1, modo "Por categoría" (vista B) — ítems de availableCategories.
   * Toggle en categoryIds.
   */
  const legendItemsCategoryB = availableCategories.map((cat) => ({
    id: cat.categoryId,
    color: cat.color,
    label: cat.name,
  }));

  /**
   * Caso C: Forma 2 (by-category) — ítems de availableCategories.
   * Toggle en categoryIds.
   */
  const legendItemsF2 = availableCategories.map((cat) => ({
    id: cat.categoryId,
    color: cat.color,
    label: cat.name,
  }));

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade"
      aria-label={`${displayTitle} ${year}`}
    >
      {/* ── Cabecera de la card ── */}
      {/*
        Spec visual: docs/design.md §"Título editable de la card de reporte (Ola 2, P4)".

        by-category (≥941px):
          Fila única flex justify-between:
            Izq: [título editable]
            Der: [stepper · moneda · X]
          ≤940px: wrap natural — controles bajan a segunda línea.

        income-expense (≥941px):
          Línea 1 (ancho completo): [título editable]
          Línea 2 flex justify-between: [ViewTabs] / [stepper · moneda · X]
          ≤940px: wrap natural — orden vertical: [título] → [ViewTabs] → [controles].
      */}

      {/* ── BLOQUE by-category: una sola fila justify-between ── */}
      {type === "by-category" && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
          {/* Identidad: solo el título editable (izquierda) — sin eyebrow */}
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
          />
        </div>
      )}

      {/* ── BLOQUE income-expense: línea 1 (identidad) + línea 2 (tabs+controles) ── */}
      {type === "income-expense" && (
        <>
          {/* Línea 1: solo el título editable (ancho completo) — sin eyebrow */}
          <div className="w-full mb-[6px]">
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
          {/* Línea 2: [ViewTabs izq] / [controles der] — idéntica a antes de P4 */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
            <ViewTabs
              value={categoryBreakdown}
              onChange={(v) => onCategoryBreakdownChange?.(v)}
              panelId={CHART_PANEL_ID}
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
                    currency={effectiveCurrency}
                    hiddenSeries={hiddenSeries}
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
                    currency={effectiveCurrency}
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
                  currency={effectiveCurrency}
                />
              );
            }}
          </ChartResponsiveArea>

          {/* ─ Leyendas interactivas ─ */}

          {/* Caso A: Forma 1 — modo "Total" (vista A): Ingresos / Gastos */}
          {/* SIN scroll, SIN atajo Todas/Ninguna: son 2 ítems fijos — fila plana. */}
          {data && type === "income-expense" && !isViewB && (
            <ChartLegend
              items={legendItemsTotalF1}
              hiddenIds={hiddenSeries}
              onToggle={handleSeriesLegendToggle}
              groupLabel="Filtrar series"
            />
          )}

          {/* Caso B: Forma 1 — modo "Por categoría" (vista B): categorías de gasto */}
          {/* CON scroll (max-h-84px) + LegendAllChip en carril fijo debajo. */}
          {data && isViewB && availableCategories.length > 0 && (
            <ChartLegend
              items={legendItemsCategoryB}
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

          {/* Caso C: Forma 2 (by-category): categorías de gasto */}
          {/* CON scroll (max-h-84px) + LegendAllChip en carril fijo debajo. */}
          {data && type === "by-category" && availableCategories.length > 0 && (
            <ChartLegend
              items={legendItemsF2}
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
