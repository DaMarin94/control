"use client";

/**
 * Gráfico anual — RF-GRA-001/002/003.
 *
 * Dos tarjetas autónomas exportadas por separado:
 *   - IncomeExpenseCard  — Forma 1 (AreaChart, ingresos vs gastos)
 *   - ByCategoryCard     — Forma 2 (BarChart apilado, gastos por categoría)
 *
 * Ambas consumen useAnnual(year); React Query dedupea por la clave ["annual", year].
 *
 * Puntos de uso:
 *   - Dashboard (/):       solo IncomeExpenseCard (año fijo, sin control de año)
 *   - Pantalla /anual:     IncomeExpenseCard + ByCategoryCard apiladas;
 *                          el control ‹ › vive en el .phead de la página (fuera de las tarjetas).
 *
 * Spec visual: docs/design.md, sección "Gráfico anual — spec visual del widget".
 *
 * prefers-reduced-motion:
 *   isAnimationActive={false} en todos los charts cuando reduced-motion está activo.
 *   Detección con useReducedMotion (hook privado del módulo).
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
import { AlertTriangle } from "lucide-react";
import { useAnnual } from "@/hooks/use-annual";
import { formatCurrency } from "@/lib/format";
import { ChartTooltipContent } from "@/components/ui/chart";
import { ChartLegend } from "@/components/ui/chart";
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

// ─── Tooltip — Forma 2 ────────────────────────────────────────────────────────

interface Form2TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string | number;
  data: AnnualMovementsResponse;
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

// ─── Skeleton de tarjeta ──────────────────────────────────────────────────────

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div>
      <div
        className="animate-pulse rounded-ctl bg-panel-3"
        style={{ height }}
        aria-hidden="true"
      />
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

// ─── Estado de error de tarjeta ───────────────────────────────────────────────

function ChartError({ height, onRetry }: { height: number; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{ height }}
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
        onClick={onRetry}
        className="rounded-ctl border border-line bg-panel px-3 py-[6px] text-[13px] font-semibold text-ink-2 shadow-[var(--shadow-sm)] transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
      >
        Reintentar
      </button>
    </div>
  );
}

// ─── Estructura interna de cabecera de tarjeta ────────────────────────────────

interface CardHeaderProps {
  /** Título de la tarjeta ("Ingresos y gastos" o "Por categoría"). */
  title: string;
  /** Si se muestra el año como cifra mono (solo en Dashboard, Forma 1). */
  year?: number;
}

function CardHeader({ title, year }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-[18px]">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
          Resumen anual
        </p>
        <p className="text-[16px] font-semibold leading-tight mt-[3px] text-ink">
          {title}
        </p>
      </div>
      {year !== undefined && (
        <span className="mono text-[20px] font-semibold text-ink">
          {year}
        </span>
      )}
    </div>
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
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="areaIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--income)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--income)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="areaExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--expense)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          horizontal
          vertical={false}
          stroke="var(--hair)"
          strokeWidth={1}
        />

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

        <YAxis
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={formatYAxisTick}
          tick={{
            fontSize: 11.5,
            fill: "var(--muted)",
            fontFamily: "var(--mono)",
          }}
          width={64}
        />

        <Tooltip
          cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
          content={({ active, payload, label }) => (
            <Form1Tooltip
              active={active}
              payload={payload as unknown as Array<{ dataKey: string; value: number }>}
              label={label}
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

// ─── Forma 2 — BarChart interno ───────────────────────────────────────────────

interface Form2ChartInnerProps {
  chartData: ChartDataPoint[];
  data: AnnualMovementsResponse;
  year: number;
  height: number;
  reducedMotion: boolean;
}

function Form2ChartInner({ chartData, data, year, height, reducedMotion }: Form2ChartInnerProps) {
  const categories = data.categories;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        barCategoryGap="27%"
      >
        <CartesianGrid
          horizontal
          vertical={false}
          stroke="var(--hair)"
          strokeWidth={1}
        />

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

        <YAxis
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={formatYAxisTick}
          tick={{
            fontSize: 11.5,
            fill: "var(--muted)",
            fontFamily: "var(--mono)",
          }}
          width={64}
        />

        <Tooltip
          cursor={{ fill: "var(--accent-soft)", fillOpacity: 0.5 }}
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

        {categories.map((cat, idx) => {
          const isTop = idx === categories.length - 1;
          return (
            <Bar
              key={cat.categoryId}
              dataKey={cat.categoryId}
              stackId="categories"
              fill={cat.color}
              stroke="var(--panel)"
              strokeWidth={1}
              radius={isTop ? [7, 7, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={!reducedMotion}
              animationDuration={400}
              animationEasing="ease-out"
            >
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

// ─── Área del gráfico con responsivo ──────────────────────────────────────────

/**
 * Renderiza el gráfico con dos versiones: desktop (altura por prop) y mobile (220px).
 * El responsive se maneja con media queries de Tailwind v4 — dos divs con hidden/visible.
 */
interface ChartResponsiveAreaProps {
  desktopHeight: number;
  children: (height: number) => React.ReactNode;
}

function ChartResponsiveArea({ desktopHeight, children }: ChartResponsiveAreaProps) {
  return (
    <>
      {/* Desktop: altura por prop */}
      <div className="[@media(max-width:940px)]:hidden" style={{ height: desktopHeight }}>
        {children(desktopHeight)}
      </div>
      {/* Mobile ≤940px: 220px */}
      <div className="[@media(min-width:941px)]:hidden" style={{ height: 220 }}>
        {children(220)}
      </div>
    </>
  );
}

// ─── IncomeExpenseCard ─────────────────────────────────────────────────────────

export interface IncomeExpenseCardProps {
  /** Año a mostrar. */
  year: number;
  /**
   * Alto del área de gráfico en desktop (px).
   * 280 en dashboard, 300 en /anual. Default: 280.
   */
  chartHeight?: number;
  /**
   * Si se muestra el año como cifra mono en la cabecera de la tarjeta.
   * true = dashboard (año fijo, sin control externo).
   * false = /anual (el año vive en el control compartido del .phead).
   * Default: false.
   */
  showYearInHeader?: boolean;
}

/**
 * Tarjeta "Ingresos y gastos" — Forma 1.
 * AreaChart: dos series superpuestas (income / expense), NO apiladas.
 *
 * Se monta en el Dashboard (año fijo, showYearInHeader=true)
 * y en /anual (showYearInHeader=false, el año está en el .phead).
 */
export function IncomeExpenseCard({
  year,
  chartHeight = 280,
  showYearInHeader = false,
}: IncomeExpenseCardProps) {
  const reducedMotion = useReducedMotion();
  const { data, isLoading, isError, refetch } = useAnnual(year);

  const chartData = data ? buildChartData(data) : [];
  const isYearEmpty =
    data !== undefined &&
    data.months.every((m) => m.incomeCents === 0 && m.expenseCents === 0);

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)]"
      aria-label={`Ingresos y gastos ${year}`}
    >
      <CardHeader
        title="Ingresos y gastos"
        year={showYearInHeader ? year : undefined}
      />

      {isLoading ? (
        <ChartSkeleton height={chartHeight} />
      ) : isError ? (
        <ChartError height={chartHeight} onRetry={() => refetch()} />
      ) : (
        <div className="relative">
          {isYearEmpty && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              aria-live="polite"
            >
              <p className="text-[14px] text-muted">Sin movimientos en {year}.</p>
            </div>
          )}

          <ChartResponsiveArea desktopHeight={chartHeight}>
            {(height) => (
              <Form1ChartInner
                chartData={chartData}
                year={year}
                height={height}
                reducedMotion={reducedMotion}
              />
            )}
          </ChartResponsiveArea>

          {data && (
            <ChartLegend
              items={[
                { color: "var(--income)", label: "Ingresos" },
                { color: "var(--expense)", label: "Gastos" },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── ByCategoryCard ───────────────────────────────────────────────────────────

export interface ByCategoryCardProps {
  /** Año a mostrar. */
  year: number;
  /**
   * Alto del área de gráfico en desktop (px).
   * 300 en /anual. Default: 300.
   */
  chartHeight?: number;
}

/**
 * Tarjeta "Por categoría" — Forma 2.
 * BarChart apilado: una barra por mes, una banda por categoría con su color.
 *
 * Solo se monta en /anual (las dos tarjetas apiladas). No va en el Dashboard.
 */
export function ByCategoryCard({ year, chartHeight = 300 }: ByCategoryCardProps) {
  const reducedMotion = useReducedMotion();
  const { data, isLoading, isError, refetch } = useAnnual(year);

  const chartData = data ? buildChartData(data) : [];

  // Vacío en Forma 2: sin gastos en ningún mes del año
  const isYearEmpty =
    data !== undefined &&
    data.months.every((m) => m.expenseCents === 0);

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)]"
      aria-label={`Gastos por categoría ${year}`}
    >
      <CardHeader title="Por categoría" />

      {isLoading ? (
        <ChartSkeleton height={chartHeight} />
      ) : isError ? (
        <ChartError height={chartHeight} onRetry={() => refetch()} />
      ) : (
        <div className="relative">
          {isYearEmpty && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              aria-live="polite"
            >
              <p className="text-[14px] text-muted">Sin movimientos en {year}.</p>
            </div>
          )}

          <ChartResponsiveArea desktopHeight={chartHeight}>
            {(height) => (
              <Form2ChartInner
                chartData={chartData}
                data={data!}
                year={year}
                height={height}
                reducedMotion={reducedMotion}
              />
            )}
          </ChartResponsiveArea>

          {data && data.categories.length > 0 && (
            <ChartLegend
              items={data.categories.map((cat) => ({
                color: cat.color,
                label: cat.name,
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
