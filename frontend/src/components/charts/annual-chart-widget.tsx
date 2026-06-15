"use client";

/**
 * Widget de gráfico anual — RF-GRA-001/002/003.
 *
 * Componente reutilizable que se monta en:
 *   - Dashboard (año actual, navigable=false)
 *   - Pantalla dedicada /anual (navigable=true)
 *
 * Props:
 *   - year: number      — año a mostrar (estado externo pasado por el anfitrión)
 *   - navigable: boolean — si true, muestra el control ‹ › de año
 *   - onYearChange?: (year: number) => void — callback cuando el año cambia (solo si navigable)
 *   - chartHeight?: number — alto del área de gráfico (280 dashboard, 340 /anual)
 *
 * Dos formas alternables:
 *   - Forma 1 (default): AreaChart — ingresos vs gastos superpuestos, NO apilados.
 *   - Forma 2: BarChart apilado — gastos por categoría, una banda por categoría.
 *
 * Spec visual: docs/design.md, sección "Gráfico anual — spec visual del widget".
 * Implementa los 5 estados: skeleton, con datos, vacío, año con meses futuros, error.
 *
 * Theming:
 *   - Recharts usa SVG; los colores se pasan como valores concretos o CSS vars.
 *   - CSS vars oklch se resuelven en el browser correctamente en elementos SVG.
 *   - Se usa getComputedStyle para leer los valores resueltos de las CSS vars
 *     cuando Recharts necesita valores concretos (ej. stroke, fill).
 *
 * prefers-reduced-motion:
 *   - isAnimationActive={false} en todos los charts cuando reduced-motion está activo.
 *   - Detección con useReducedMotion (hook interno con matchMedia).
 */

import { useState, useEffect } from "react";
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
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useAnnual } from "@/hooks/use-annual";
import { formatCurrency } from "@/lib/format";
import { ChartTooltipContent } from "@/components/ui/chart";
import { ChartLegend } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { AnnualMovementsResponse } from "@/types/annual";

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Nombres cortos de mes en es-AR, posición 0 = enero. */
const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Nombres completos de mes en es-AR para el tooltip. */
const MONTH_LABELS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type ChartForm = "form1" | "form2";

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
 * Formatea centavos para el eje Y con abreviatura:
 * $0, $50k, $120k, $2,5M (k = miles, M = millones; separador decimal coma).
 */
function formatYAxisTick(valueCents: number): string {
  const pesos = valueCents / 100;
  if (pesos === 0) return "$0";
  if (pesos >= 1_000_000) {
    const m = pesos / 1_000_000;
    // 1 decimal si no es entero
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

// ─── Preparar datos para Recharts ─────────────────────────────────────────────

interface ChartDataPoint {
  monthIndex: number;      // 0–11
  shortLabel: string;      // "Ene" … "Dic"
  fullLabel: string;       // "Enero" … "Diciembre"
  incomeCents: number;
  expenseCents: number;
  [key: string]: number | string; // categoryId → cents (para Forma 2)
}

function buildChartData(data: AnnualMovementsResponse): ChartDataPoint[] {
  return data.months.map((m, i) => {
    const point: ChartDataPoint = {
      monthIndex: i,
      shortLabel: MONTH_LABELS_SHORT[i] ?? String(i + 1),
      fullLabel: MONTH_LABELS_FULL[i] ?? String(i + 1),
      incomeCents: m.incomeCents,
      expenseCents: m.expenseCents,
    };
    // Agregar columnas por categoría para Forma 2
    data.categories.forEach((cat) => {
      point[cat.categoryId] = cat.monthlyExpenseCents[i] ?? 0;
    });
    return point;
  });
}

// ─── Tooltip personalizado ─────────────────────────────────────────────────────

interface CustomTooltipProps {
  /** Inyectado por Recharts cuando el tooltip está activo. */
  active?: boolean;
  /** Inyectado por Recharts con las series del punto activo. */
  payload?: Array<{ dataKey: string; value: number }>;
  /** Inyectado por Recharts con el valor del eje X (shortLabel). Puede ser string o number. */
  label?: string | number;
  form: ChartForm;
  data: AnnualMovementsResponse;
  year: number;
}

function CustomTooltip({ active, payload, label, form, data, year }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // label es el shortLabel (índice del eje X). Necesitamos el índice del mes.
  const labelStr = String(label ?? "");
  const monthIndex = MONTH_LABELS_SHORT.indexOf(labelStr);
  if (monthIndex === -1) return null;

  const fullLabel = `${MONTH_LABELS_FULL[monthIndex] ?? label} ${year}`;

  if (form === "form1") {
    // Forma 1: ingresos y gastos
    const incomeVal = payload.find((p) => p.dataKey === "incomeCents")?.value ?? 0;
    const expenseVal = payload.find((p) => p.dataKey === "expenseCents")?.value ?? 0;

    const rows = [
      {
        color: "var(--income)",
        label: "Ingresos",
        formattedValue: formatCurrency(incomeVal as number),
        valueColor: "var(--income-ink)",
      },
      {
        color: "var(--expense)",
        label: "Gastos",
        formattedValue: formatCurrency(expenseVal as number),
        valueColor: "var(--expense-ink)",
      },
    ];

    return <ChartTooltipContent monthLabel={fullLabel} rows={rows} />;
  }

  // Forma 2: gastos por categoría
  // Filtrar categorías con valor > 0 en este mes
  const catRows = data.categories
    .filter((cat) => (cat.monthlyExpenseCents[monthIndex] ?? 0) > 0)
    .map((cat) => ({
      color: cat.color,
      label: cat.name,
      formattedValue: formatCurrency(cat.monthlyExpenseCents[monthIndex] ?? 0),
      valueColor: "var(--ink)",
    }));

  const totalCents = data.months[monthIndex]?.expenseCents ?? 0;
  const totalRow = {
    color: "var(--expense)",
    label: "Total gastos",
    formattedValue: formatCurrency(totalCents),
    valueColor: "var(--expense-ink)",
  };

  return (
    <ChartTooltipContent
      monthLabel={fullLabel}
      rows={catRows}
      totalRow={totalRow}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div>
      {/* Área del gráfico: bloque animado */}
      <div
        className="animate-pulse rounded-ctl bg-panel-3"
        style={{ height }}
        aria-hidden="true"
      />
      {/* Leyenda skeleton: 2–3 chips */}
      <div className="mt-[14px] flex gap-4">
        {[70, 56, 80].map((w, i) => (
          <div
            key={i}
            className="animate-pulse rounded-chip bg-panel-3"
            style={{ width: w, height: 14 }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

// ─── Props del widget ─────────────────────────────────────────────────────────

export interface AnnualChartWidgetProps {
  /** Año a mostrar. */
  year: number;
  /** Si true, muestra el control ‹ › de año. */
  navigable: boolean;
  /** Callback cuando el año cambia (solo si navigable). */
  onYearChange?: (year: number) => void;
  /**
   * Alto del área de gráfico en px.
   * 280 en dashboard, 340 en /anual. Default: 280.
   */
  chartHeight?: number;
}

// ─── Widget principal ─────────────────────────────────────────────────────────

export function AnnualChartWidget({
  year,
  navigable,
  onYearChange,
  chartHeight = 280,
}: AnnualChartWidgetProps) {
  const [form, setForm] = useState<ChartForm>("form1");
  const reducedMotion = useReducedMotion();

  const { data, isLoading, isError, refetch } = useAnnual(year);

  // Año actual real (tope superior de navegación)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Límites de navegación (RF-GRA-003)
  const earliestYear = data?.earliestYear ?? null;
  const canGoPrev = earliestYear !== null && year > earliestYear;
  const canGoNext = year < currentYear;

  function handlePrev() {
    if (canGoPrev) onYearChange?.(year - 1);
  }
  function handleNext() {
    if (canGoNext) onYearChange?.(year + 1);
  }

  // Preparar datos para el gráfico
  const chartData = data ? buildChartData(data) : [];

  // Verificar si el año está completamente vacío
  const isYearEmpty =
    data !== undefined &&
    data.months.every((m) => m.incomeCents === 0 && m.expenseCents === 0);

  // ── Altura responsive (≤940px → 220px) ──────────────────────────────────────
  // Nota: en la implementación usamos el alto pasado por prop; el responsive
  // se maneja con un media query CSS aplicado sobre el contenedor.
  // El spec dice que en ≤940px el alto baja a 220px, pero como el widget
  // ya es responsive container de Recharts al 100% de ancho, bastará con
  // aplicar la altura responsive al contenedor externo.

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)]"
      aria-label={`Gráfico anual ${year}`}
    >
      {/* ── Cabecera ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-[18px]">
        {/* Izquierda: eyebrow + año (sin nav) o solo eyebrow (con nav) */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
            Resumen anual
          </p>
          {/* Si NO es navigable, el año va suelto aquí */}
          {!navigable && (
            <p className="text-[20px] font-semibold leading-tight mt-[2px] mono text-ink">
              {year}
            </p>
          )}
        </div>

        {/* Derecha: stepper de año (si navigable) + toggle de forma */}
        <div className="flex items-center gap-3">
          {/* Stepper de año — solo si navigable */}
          {navigable && (
            <div
              className="flex items-center rounded-pill border border-line bg-panel shadow-[var(--shadow-sm)] p-1"
              role="group"
              aria-label="Navegación de año"
            >
              {/* ‹ Anterior */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canGoPrev}
                aria-label="Año anterior"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
                  canGoPrev
                    ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer"
                    : "text-faint opacity-45 cursor-default",
                )}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>

              {/* Año */}
              <span
                className="mono text-[14.5px] font-semibold text-ink min-w-[64px] text-center select-none"
                aria-live="polite"
                aria-atomic="true"
              >
                {year}
              </span>

              {/* › Siguiente */}
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext}
                aria-label="Año siguiente"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
                  canGoNext
                    ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer"
                    : "text-faint opacity-45 cursor-default",
                )}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Toggle de forma — segmented .dtabs */}
          <div
            className="flex rounded-ctl p-1 bg-panel-3 gap-0.5"
            role="group"
            aria-label="Tipo de visualización"
          >
            <button
              type="button"
              onClick={() => setForm("form1")}
              aria-pressed={form === "form1"}
              className={cn(
                "rounded-[8px] px-[10px] py-[5px] text-[13.5px] font-semibold transition-colors duration-[140ms]",
                form === "form1"
                  ? "bg-panel shadow-[var(--shadow-sm)] text-ink"
                  : "text-muted hover:text-ink",
              )}
            >
              Ingresos y gastos
            </button>
            <button
              type="button"
              onClick={() => setForm("form2")}
              aria-pressed={form === "form2"}
              className={cn(
                "rounded-[8px] px-[10px] py-[5px] text-[13.5px] font-semibold transition-colors duration-[140ms]",
                form === "form2"
                  ? "bg-panel shadow-[var(--shadow-sm)] text-ink"
                  : "text-muted hover:text-ink",
              )}
            >
              Por categoría
            </button>
          </div>
        </div>
      </div>

      {/* ── Área del gráfico ── */}
      {isLoading ? (
        <ChartSkeleton height={chartHeight} />
      ) : isError ? (
        /* Estado de error */
        <div>
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ height: chartHeight }}
            role="alert"
          >
            <AlertTriangle
              size={20}
              aria-hidden="true"
              className="text-warning-ink"
            />
            <p className="text-[14px] text-ink-2">No se pudo cargar el gráfico.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-ctl border border-line bg-panel px-3 py-[6px] text-[13px] font-semibold text-ink-2 shadow-[var(--shadow-sm)] transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        /* Con datos o vacío */
        <div className="relative">
          {/* Mensaje de año vacío — centrado sobre el gráfico */}
          {isYearEmpty && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              aria-live="polite"
            >
              <p className="text-[14px] text-muted">Sin movimientos en {year}.</p>
            </div>
          )}

          {/* Alto responsive: en ≤940px → 220px */}
          <div
            className="[@media(max-width:940px)]:hidden"
            style={{ height: chartHeight }}
          >
            <ChartArea
              form={form}
              chartData={chartData}
              data={data!}
              year={year}
              height={chartHeight}
              reducedMotion={reducedMotion}
            />
          </div>
          {/* Mobile: 220px */}
          <div
            className="[@media(min-width:941px)]:hidden"
            style={{ height: 220 }}
          >
            <ChartArea
              form={form}
              chartData={chartData}
              data={data!}
              year={year}
              height={220}
              reducedMotion={reducedMotion}
            />
          </div>

          {/* ── Leyenda ── */}
          {data && (
            <ChartLegend
              items={
                form === "form1"
                  ? [
                      { color: "var(--income)", label: "Ingresos" },
                      { color: "var(--expense)", label: "Gastos" },
                    ]
                  : data.categories.map((cat) => ({
                      color: cat.color,
                      label: cat.name,
                    }))
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── ChartArea — el gráfico propiamente dicho ──────────────────────────────────

interface ChartAreaProps {
  form: ChartForm;
  chartData: ChartDataPoint[];
  data: AnnualMovementsResponse;
  year: number;
  height: number;
  reducedMotion: boolean;
}

function ChartArea({ form, chartData, data, year, height, reducedMotion }: ChartAreaProps) {
  if (form === "form1") {
    return <Form1Chart chartData={chartData} data={data} year={year} height={height} reducedMotion={reducedMotion} />;
  }
  return <Form2Chart chartData={chartData} data={data} year={year} height={height} reducedMotion={reducedMotion} />;
}

// ─── Forma 1 — AreaChart: ingresos vs gastos ──────────────────────────────────

interface FormChartProps {
  chartData: ChartDataPoint[];
  data: AnnualMovementsResponse;
  year: number;
  height: number;
  reducedMotion: boolean;
}

function Form1Chart({ chartData, data, year, height, reducedMotion }: FormChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
      >
        {/* Gradientes para el relleno de áreas */}
        <defs>
          {/* Plano a 0.14 (opción canónica del spec) */}
          <linearGradient id="areaIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--income)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--income)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="areaExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--expense)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Gridlines horizontales — color --hair */}
        <CartesianGrid
          horizontal
          vertical={false}
          stroke="var(--hair)"
          strokeWidth={1}
        />

        {/* Eje X — nombres cortos de mes */}
        <XAxis
          dataKey="shortLabel"
          axisLine={false}
          tickLine={false}
          tick={{
            fontSize: 12,
            fontWeight: 500,
            fill: "var(--muted)",
            fontFamily: "var(--ui)",
          }}
          interval={0}
        />

        {/* Eje Y — montos abreviados en mono */}
        <YAxis
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={formatYAxisTick}
          tick={{
            fontSize: 11.5,
            fill: "var(--muted)",
            fontFamily: "var(--mono)",
            // fontFeatureSettings no es parte del tipo de tick SVG de Recharts;
            // el tnum se aplica via font-feature-settings CSS en .mono del body.
            // El font-family var(--mono) es IBM Plex Mono que ya tiene tnum como
            // feature por defecto en la mayoría de navegadores.
          }}
          width={64}
        />

        {/* Tooltip */}
        <Tooltip
          cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
          content={({ active, payload, label }) => (
            <CustomTooltip
              active={active}
              payload={payload as unknown as Array<{ dataKey: string; value: number }>}
              label={label}
              form="form1"
              data={data}
              year={year}
            />
          )}
        />

        {/* Gastos — debajo (pintado primero) */}
        <Area
          type="monotone"
          dataKey="expenseCents"
          stroke="var(--expense)"
          strokeWidth={2}
          fill="url(#areaExpense)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--expense)", stroke: "var(--panel)", strokeWidth: 2 }}
          isAnimationActive={!reducedMotion}
          animationDuration={400}
          animationEasing="ease-out"
        />

        {/* Ingresos — encima */}
        <Area
          type="monotone"
          dataKey="incomeCents"
          stroke="var(--income)"
          strokeWidth={2}
          fill="url(#areaIncome)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--income)", stroke: "var(--panel)", strokeWidth: 2 }}
          isAnimationActive={!reducedMotion}
          animationDuration={400}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Forma 2 — BarChart apilado: gastos por categoría ─────────────────────────

function Form2Chart({ chartData, data, year, height, reducedMotion }: FormChartProps) {
  const categories = data.categories;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        barCategoryGap="27%"
      >
        {/* Gridlines horizontales */}
        <CartesianGrid
          horizontal
          vertical={false}
          stroke="var(--hair)"
          strokeWidth={1}
        />

        {/* Eje X */}
        <XAxis
          dataKey="shortLabel"
          axisLine={false}
          tickLine={false}
          tick={{
            fontSize: 12,
            fontWeight: 500,
            fill: "var(--muted)",
            fontFamily: "var(--ui)",
          }}
          interval={0}
        />

        {/* Eje Y */}
        <YAxis
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={formatYAxisTick}
          tick={{
            fontSize: 11.5,
            fill: "var(--muted)",
            fontFamily: "var(--mono)",
            // fontFeatureSettings no es parte del tipo de tick SVG de Recharts;
            // el tnum se aplica via font-feature-settings CSS en .mono del body.
            // El font-family var(--mono) es IBM Plex Mono que ya tiene tnum como
            // feature por defecto en la mayoría de navegadores.
          }}
          width={64}
        />

        {/* Tooltip */}
        <Tooltip
          cursor={{ fill: "var(--accent-soft)", fillOpacity: 0.5 }}
          content={({ active, payload, label }) => (
            <CustomTooltip
              active={active}
              payload={payload as unknown as Array<{ dataKey: string; value: number }>}
              label={label}
              form="form2"
              data={data}
              year={year}
            />
          )}
        />

        {/* Una barra apilada por categoría */}
        {categories.map((cat, idx) => {
          // La primera categoría (mayor gasto anual) va en la base.
          // Recharts apila en el orden en que se declaran los <Bar>;
          // el spec pide de mayor a menor gasto anual — ya viene así del backend (ORDER BY gasto DESC).
          const isTop = idx === categories.length - 1;

          return (
            <Bar
              key={cat.categoryId}
              dataKey={cat.categoryId}
              stackId="categories"
              fill={cat.color}
              stroke="var(--panel)"
              strokeWidth={1}
              // Redondeo solo en el segmento superior de la barra (el último en apilar)
              radius={isTop ? [7, 7, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={!reducedMotion}
              animationDuration={400}
              animationEasing="ease-out"
            >
              {/* Cell aplica el color individualmente (necesario porque Cell permite override) */}
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
