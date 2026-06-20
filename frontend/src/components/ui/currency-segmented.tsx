"use client";

/**
 * CurrencySegmented — Segmented neutro ARS/USD (Fase 1.2.3).
 *
 * Reutilizable en /configuracion y en los formularios de movimiento.
 *
 * Spec visual (docs/design.md §"Multi-moneda ARS/USD + /configuracion"):
 * - Pista pill `--panel-3` (track), radio `--r-pill`, padding interno `2px`.
 * - Dos segmentos de ancho igual, texto 13px/600 `px-[14px] py-[6px]`, radio `--r-pill`.
 * - Etiquetas: "ARS" / "USD" en `mono` (nomenclatura de moneda).
 * - Segmento seleccionado: thumb `--panel` (blanco) + `--shadow-sm`, texto `--ink`.
 *   Se desliza entre las 2 posiciones (0.14s; instantáneo con prefers-reduced-motion).
 * - Segmento no seleccionado: texto `--muted`; hover → `--ink-2`.
 * - Sin color semántico ni índigo en los segmentos (la moneda no es income/expense/marca).
 * - Foco: ring `--accent-soft` 3px sobre el segmento activo.
 * - `role="radiogroup"`, cada segmento `role="radio"` / `aria-checked`.
 *
 * RESTRICCIÓN CRÍTICA: los colores son neutros — NUNCA usar colores de income/expense/accent
 * en los segmentos activos/inactivos (regla dura nueva Fase 1.2.3).
 */

import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" },
];

interface CurrencySegmentedProps {
  value: CurrencyCode;
  onChange: (value: CurrencyCode) => void;
  /** aria-label del radiogroup (default: "Moneda") */
  ariaLabel?: string;
  /** Deshabilitar el control */
  disabled?: boolean;
}

export function CurrencySegmented({
  value,
  onChange,
  ariaLabel = "Moneda",
  disabled = false,
}: CurrencySegmentedProps) {
  const selectedIndex = CURRENCIES.findIndex((c) => c.value === value);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (index + 1) % CURRENCIES.length;
      onChange(CURRENCIES[next]!.value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (index - 1 + CURRENCIES.length) % CURRENCIES.length;
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
          left: `calc(${(selectedIndex / 2) * 100}% + 2px)`,
          width: `calc(50% - 4px)`,
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
              "relative z-10 flex-1 rounded-pill px-[14px] py-[6px]",
              "text-[13px] font-semibold mono tracking-[0.01em]",
              "transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
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
