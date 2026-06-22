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
  /** Id único del ítem (key de React, también se usa como identificador de toggle). */
  id: string;
  color: string;
  label: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  /**
   * Ids de los ítems actualmente OCULTOS (apagados).
   * Si se pasa → leyenda interactiva (toggle buttons).
   * Si se omite → leyenda decorativa (divs, comportamiento anterior).
   */
  hiddenIds?: string[];
  /**
   * Callback al togglear un ítem. Solo se invoca cuando hiddenIds está definido.
   * Recibe el id del ítem clickeado.
   */
  onToggle?: (id: string) => void;
  /**
   * Etiqueta del grupo de toggles para a11y.
   * "Filtrar series" (Forma 1 Total) | "Filtrar categorías" (Forma 1 Por cat + Forma 2).
   * Solo se usa cuando la leyenda es interactiva.
   */
  groupLabel?: string;
  className?: string;
}

/**
 * Leyenda themeada con tokens del DS.
 *
 * Modo decorativo (sin hiddenIds): divs, aria-label "Leyenda del gráfico".
 * Modo interactivo (con hiddenIds): grupo de toggle buttons aria-pressed.
 *
 * Estados del ítem interactivo (spec design.md §"Leyenda interactiva"):
 * - Activo: swatch color pleno, etiqueta --ink-2.
 * - Apagado: swatch outline (border color, interior --panel), etiqueta line-through --muted, opacidad 0.7.
 * - Hover activo: fondo --panel-2, etiqueta --ink.
 * - Hover apagado: fondo --panel-2, etiqueta sube a --ink-2 (sigue tachada), opacidad 0.85.
 * - Active/pressed: fondo --panel-3.
 * - Focus: ring --accent-soft 3px, radio --r-chip (7px).
 *
 * Layout: -mx-[6px] en el contenedor para compensar el padding lateral de los botones
 * (el swatch del primer ítem queda alineado al eje del gráfico, igual que la leyenda decorativa).
 * gap-x-[10px] + px-[6px] de cada botón ≈ 16px de aire visual entre swatches (misma densidad).
 */
export function ChartLegend({ items, hiddenIds, onToggle, groupLabel, className }: ChartLegendProps) {
  const isInteractive = hiddenIds !== undefined;

  if (!isInteractive) {
    // ── Modo decorativo (comportamiento anterior) ──
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 mt-[14px]",
          className,
        )}
        aria-label="Leyenda del gráfico"
      >
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-[6px]">
            <span
              className="shrink-0 rounded-[3px]"
              style={{ width: 10, height: 10, background: item.color }}
              aria-hidden="true"
            />
            <span className="text-[12.5px] font-medium text-ink-2 select-none">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── Modo interactivo (toggle buttons) ──
  return (
    <div
      role="group"
      aria-label={groupLabel ?? "Filtrar series"}
      className={cn(
        "flex flex-wrap items-center gap-x-[10px] gap-y-[6px] mt-[14px] -mx-[6px]",
        className,
      )}
    >
      {items.map((item) => {
        const isOff = hiddenIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={!isOff}
            onClick={() => onToggle?.(item.id)}
            className={cn(
              // "group" permite que los spans hijos reaccionen al hover del botón
              "group inline-flex items-center gap-[6px] px-[6px] py-[4px] rounded-[7px]",
              "cursor-pointer transition-[background-color,opacity] duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              // Hover/active — aplica en ambos estados on/off
              "hover:bg-panel-2 active:bg-panel-3",
              // Estado apagado: opacidad 0.7 base, sube a 0.85 en hover
              isOff
                ? "opacity-70 hover:opacity-85"
                : "opacity-100",
            )}
          >
            {/* Swatch: color pleno (activo) u outline (apagado) */}
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
            {/* Etiqueta:
                Activo: --ink-2 → --ink en hover del botón (group-hover:text-ink).
                Apagado: --muted + line-through → --ink-2 en hover del botón (group-hover:text-ink-2), sigue tachado. */}
            <span
              className={cn(
                "text-[12.5px] font-medium select-none transition-colors duration-[140ms]",
                isOff
                  ? "line-through text-muted group-hover:text-ink-2"
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
