"use client";

/**
 * CurrencySegmented — Segmented neutro ARS/USD/EUR/BRL (Fase 1.2.4).
 *
 * Reutilizable en /configuracion y en los formularios de movimiento.
 *
 * Spec visual (docs/design.md §"Monedas configurables — set curado ARS/USD/EUR/BRL"):
 * - Pista pill `--panel-3` (track), radio `--r-pill`, padding interno `2px`.
 * - 4 segmentos de ancho igual, texto 13px/600 `mono`, radio `--r-pill`.
 * - Etiquetas: "ARS" / "USD" / "EUR" / "BRL" — orden fijo.
 * - Thumb deslizante a 4 posiciones: left = calc((i/4)*100% + 2px), width = calc(25% - 4px).
 * - Padding horizontal de segmento: px-[14px] en escritorio; se reduce a px-[8px] mínimo
 *   en columnas angostas (ver responsive abajo). NO se recortan etiquetas ni se reduce fuente.
 * - Responsive: si el contenedor es demasiado angosto para los 4 a 14px, el componente
 *   aplica px-[8px] como mínimo vía la clase `currency-segmented-compact`.
 *   En /configuracion cabe sin problemas (a la derecha de `flex justify-between`).
 *   En el form (grid de 2 col, mitad del ancho) puede necesitar el padding reducido.
 * - Segmento seleccionado: thumb `--panel` (blanco) + `--shadow-sm`, texto `--ink`.
 *   Se desliza entre las 4 posiciones (0.14s; instantáneo con prefers-reduced-motion).
 * - Segmento no seleccionado: texto `--muted`; hover → `--ink-2`.
 * - Sin color semántico ni índigo en los segmentos (la moneda no es income/expense/marca).
 * - Foco: ring `--accent-soft` 3px sobre el segmento activo.
 * - `role="radiogroup"`, cada segmento `role="radio"` / `aria-checked`.
 *
 * RESTRICCIÓN CRÍTICA: los colores son neutros — NUNCA usar colores de income/expense/accent
 * en los segmentos activos/inactivos (regla dura de moneda = cromo neutro).
 */

import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

/** Orden canónico: ARS/USD primero (peso de uso), EUR/BRL después. */
export const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "BRL", label: "BRL" },
];

const N = CURRENCIES.length; // 4

interface CurrencySegmentedProps {
  value: CurrencyCode;
  onChange: (value: CurrencyCode) => void;
  /** aria-label del radiogroup (default: "Moneda") */
  ariaLabel?: string;
  /** Deshabilitar el control */
  disabled?: boolean;
  /**
   * Reducir el padding horizontal de los segmentos cuando el contenedor es angosto.
   * Default: false (px-[14px]).
   * true: px-[8px] — útil en grid de 2 col donde el segmented ocupa la mitad.
   */
  compact?: boolean;
}

export function CurrencySegmented({
  value,
  onChange,
  ariaLabel = "Moneda",
  disabled = false,
  compact = false,
}: CurrencySegmentedProps) {
  const selectedIndex = CURRENCIES.findIndex((c) => c.value === value);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (index + 1) % N;
      onChange(CURRENCIES[next]!.value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (index - 1 + N) % N;
      onChange(CURRENCIES[prev]!.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex rounded-pill p-[2px]"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      {/* Thumb deslizante — neutro, sin colores semánticos */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[2px] bottom-[2px] rounded-pill bg-panel shadow-[var(--shadow-sm)]",
          "transition-[left,width] duration-[140ms] ease-out motion-reduce:transition-none",
        )}
        style={{
          left: `calc(${(selectedIndex / N) * 100}% + 2px)`,
          width: `calc(${100 / N}% - 4px)`,
        }}
      />
      {CURRENCIES.map((currency, i) => {
        const isSelected = currency.value === value;
        return (
          <button
            key={currency.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(currency.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "relative z-10 flex-1 rounded-pill py-[6px]",
              "text-[13px] font-semibold mono tracking-[0.01em]",
              "transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Padding horizontal adaptativo — compacto en columnas angostas
              compact ? "px-[8px]" : "px-[14px]",
              isSelected ? "text-ink" : "text-muted hover:text-ink-2",
            )}
          >
            {currency.label}
          </button>
        );
      })}
    </div>
  );
}
