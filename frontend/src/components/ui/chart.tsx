/**
 * Primitiva de gráfico reutilizable — ui/chart.tsx
 *
 * Capa 1 (estilo shadcn charts): wrappers de Recharts themeados con los tokens
 * del Design System "Precise Ledger". Consistente con las demás primitivas de
 * components/ui/ (cva + Tailwind v4 cuando aplique).
 *
 * Expone:
 *   - ChartContainer      — ResponsiveContainer + contexto de tema
 *   - ChartTooltipContent — contenido del tooltip themeado con tokens del DS
 *   - ChartLegend         — leyenda themeada con tokens del DS
 *
 * Motor: Recharts. Pensado para reusarse en futuros gráficos, no solo el anual.
 *
 * Theming con CSS vars oklch:
 *   - Colores de series: se pasan como prop / custom var al componente Recharts.
 *   - Recharts usa SVG; las CSS vars oklch se resuelven en el browser sin problema.
 *   - No se usan clases de Tailwind dentro de los elementos SVG (no aplican).
 *   - Para el estilo del tooltip y leyenda, que son divs del DOM, sí se usan
 *     clases de Tailwind y CSS vars.
 *
 * NOTA sobre reducción de movimiento:
 *   El prop isAnimationActive={false} se pasa desde el widget cuando
 *   prefers-reduced-motion está activo. La lógica de detección vive en el widget,
 *   no en esta primitiva (la primitiva solo recibe y pasa).
 */

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

// ─── ChartContainer ────────────────────────────────────────────────────────────

interface ChartContainerProps {
  /** Alto fijo del área de gráfico en px (no incluye cabecera ni leyenda). */
  height: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Contenedor de gráfico: ResponsiveContainer de Recharts con ancho 100%.
 * El alto es fijo (pasado por prop). Aplica font-family UI al contexto.
 */
export function ChartContainer({ height, children, className }: ChartContainerProps) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

// ─── ChartTooltipContent ───────────────────────────────────────────────────────

export interface TooltipRow {
  /** Color del swatch (hex o CSS var string resuelto). */
  color: string;
  /** Nombre de la serie o categoría. */
  label: string;
  /** Monto formateado (ya con símbolo y separadores). */
  formattedValue: string;
  /** Color del monto en el tooltip (CSS var string). Ej: "var(--income-ink)". */
  valueColor?: string;
}

interface ChartTooltipContentProps {
  /** Etiqueta del mes (ej. "Junio 2026"). */
  monthLabel: string;
  rows: TooltipRow[];
  /** Fila de total (Forma 2) — se muestra al final separada por un divisor. */
  totalRow?: TooltipRow;
}

/**
 * Contenido del tooltip themeado con tokens del DS.
 * Caja: panel blanco, borde --line, --r-ctl, --shadow-lg, padding 10px 12px.
 * Encabezado: mes en UI 12.5px/600 --ink.
 * Filas: swatch 8px + nombre (UI 12.5px --ink-2) + monto mono tabular.
 */
export function ChartTooltipContent({
  monthLabel,
  rows,
  totalRow,
}: ChartTooltipContentProps) {
  return (
    <div
      className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
      style={{ boxShadow: "var(--shadow-lg)", minWidth: "180px" }}
    >
      {/* Encabezado: mes y año */}
      <p className="mb-[8px] font-semibold text-ink">{monthLabel}</p>

      {/* Filas de series/categorías */}
      <div className="flex flex-col gap-[5px]">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-[7px]">
            {/* Swatch 8px */}
            <span
              className="shrink-0 rounded-[3px]"
              style={{ width: 8, height: 8, background: row.color }}
              aria-hidden="true"
            />
            {/* Nombre */}
            <span className="flex-1 text-ink-2 truncate">{row.label}</span>
            {/* Monto mono */}
            <span
              className="mono shrink-0"
              style={{ color: row.valueColor ?? "var(--ink-2)" }}
            >
              {row.formattedValue}
            </span>
          </div>
        ))}
      </div>

      {/* Total (Forma 2) separado por divisor */}
      {totalRow && (
        <>
          <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />
          <div className="flex items-center gap-[7px]">
            <span
              className="shrink-0 rounded-[3px]"
              style={{ width: 8, height: 8, background: totalRow.color }}
              aria-hidden="true"
            />
            <span className="flex-1 text-ink-2">{totalRow.label}</span>
            <span
              className="mono shrink-0"
              style={{ color: totalRow.valueColor ?? "var(--ink-2)" }}
            >
              {totalRow.formattedValue}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ChartLegend ──────────────────────────────────────────────────────────────

export interface LegendItem {
  color: string;
  label: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  className?: string;
}

/**
 * Leyenda themeada con tokens del DS.
 * Ítem: swatch cuadrado 10px radius 3px + etiqueta UI 12.5px/500 --ink-2.
 * Separación entre ítems 16px. flex-wrap permitido (absorbe muchos ítems).
 */
export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 mt-[14px]",
        className,
      )}
      aria-label="Leyenda del gráfico"
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-[6px]">
          <span
            className="shrink-0 rounded-[3px]"
            style={{ width: 10, height: 10, background: item.color }}
            aria-hidden="true"
          />
          <span className="text-[12.5px] font-medium text-ink-2">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
